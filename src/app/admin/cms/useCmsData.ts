import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getDateRangeIST } from "./dateRanges";
import { cycleLabel, cyclesBack } from "@/lib/billingCycle";
import { cycleRuleFor } from "@/lib/cms/providers";
import { matchCpoMobiles } from "./cpoNumbersCache";
import { filterTransactionsByRange, splitPeriod } from "./cmsHelpers";
import { getCmsWindowSnapshot, requestCmsWindow, subscribeCmsWindow, type CmsWindowSnapshot } from "./cmsWindowStore";
import { mergeTransactionData, type CmsCache, type Dashboard, type Transaction } from "./cmsCache";
import type { PlatformMetrics } from "./cmsConsumptionCard";

// The dashboard's loaded data: the saved window, the per-platform figures and the live sessions,
// kept in step with the cache by one subscription. The page reads it through this hook.
export function useCmsData({ filterCache, shownPlatforms, setLivePlatforms }: {
  filterCache: (cache: CmsCache) => CmsCache;
  shownPlatforms: readonly string[];
  setLivePlatforms: Dispatch<SetStateAction<string[]>>;
}) {
  const [baseDashboard, setBaseDashboard] = useState<Dashboard | null>(null);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics[] | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [activeTransactions, setActiveTransactions] = useState<Transaction[]>([]);
  const [active, setActive] = useState(0);
  const [activeTransactionIds, setActiveTransactionIds] = useState<Set<string>>(new Set());
  const [cpoMobileNumbers, setCpoMobileNumbers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [dataTill, setDataTill] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const applyCache = useCallback(async (cache: CmsCache, shown: readonly string[]) => {
    try {
      // Fetch one consistent transaction window for all dashboard metrics and the
      // table; the table's date filter is applied client-side and never refetches. It covers the previous
      // calendar month and the current month-to-date.
      const apply = async (cache: CmsCache) => {
      if (cache.dashboard) setBaseDashboard(cache.dashboard);
      const activeData = cache.active ?? {};

      const activeWasFetched =
        activeData.transactions !== undefined || activeData.count !== undefined;
      const currentActiveTransactions = activeData.transactions ?? [];
      setAllTransactions(cache.transactions);

      if (activeWasFetched) {
        setActiveTransactions(currentActiveTransactions);
        setActive(activeData.count ?? currentActiveTransactions.length);
        setActiveTransactionIds(
          new Set(
            currentActiveTransactions.flatMap((transaction) =>
              [transaction.transactionId, transaction.id].filter(Boolean)
            )
          )
        );
      }

      // All dashboard metrics are derived from transactions already retrieved
      // and cached locally. They do not issue separate transaction API requests,
      // and their date ranges are independent of the table's selected filter.
      try {
        const now = new Date();
        const todayRange = getDateRangeIST("today");

        const metricMap = new Map<string, Transaction>();
        for (const transaction of [...cache.transactions, ...currentActiveTransactions]) {
          const key = transaction.transactionId || transaction.id;
          if (!key) continue;
          const existing = metricMap.get(key);
          if (!existing) {
            metricMap.set(key, transaction);
          } else {
            metricMap.set(key, mergeTransactionData(existing, transaction));
          }
        }
        // Every platform shown keeps its own figures: they bill on different cycles, so a total
        // summed across two of them would match no bill.
        const allMetricTransactions = Array.from(metricMap.values());
        const cpoMobileNumbers = await matchCpoMobiles(
          allMetricTransactions.filter((transaction) => !transaction.type?.trim()).map((transaction) => transaction.mobile)
        );
        setCpoMobileNumbers(cpoMobileNumbers);
        const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
        // `end` is exclusive, so the cycle's last day is the day before it.
        const lastDay = (end: number) => dayFmt.format(new Date(end - 24 * 60 * 60 * 1000));
        const iso = (ms: number) => new Date(ms).toISOString();
        // An empty selection is the first load, before the platforms are known: everything
        // counts, on the default cycle.
        const groups: Array<string | null> = shown.length ? [...shown] : [null];
        setPlatformMetrics(groups.map((provider) => {
          const transactions = provider
            ? allMetricTransactions.filter((transaction) => transaction.provider === provider)
            : allMetricTransactions;
          // Seven cycles from the one definition in @/lib/billingCycle: the matrix shows the
          // current one and the one before, Consumption Details the five older ones.
          const rule = cycleRuleFor(provider);
          const cycleWindow = cyclesBack(now, 7, rule);
          return {
            provider: provider ?? "",
            today: splitPeriod(filterTransactionsByRange(transactions, todayRange.startDate, todayRange.endDate), cpoMobileNumbers),
            cycles: cycleWindow.slice(-2).reverse().map((cycle, index) => ({
              dates: `${dayFmt.format(new Date(cycle.start))} – ${lastDay(cycle.end)}`,
              split: splitPeriod(
                // The current cycle has not finished, so it only counts up to now.
                filterTransactionsByRange(transactions, iso(cycle.start), iso(index === 0 ? Math.min(cycle.end, now.getTime()) : cycle.end)),
                cpoMobileNumbers
              ),
            })),
            // Consumption Details carries on where the matrix stops, newest first.
            earlier: cycleWindow.slice(0, 5).reverse().map((cycle) => {
              const split = splitPeriod(filterTransactionsByRange(transactions, iso(cycle.start), iso(cycle.end)), cpoMobileNumbers);
              return { label: cycleLabel(cycle, rule), energy: split.energy.total, revenue: split.revenue.total };
            }),
          };
        }));
      } catch {
        // Metric calculation must not prevent the dashboard from rendering.
      }
      };

      await apply(cache);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CMS request failed.");
    }
  }, []);

  // The station selector narrows every card and the table; a new choice re-applies the loaded
  // window (this effect re-runs) without fetching again.
  const windowRequested = useRef(false);
  useEffect(() => {
    let shownCache: CmsCache | null = null;
    const sync = ({ cache, refreshing, error }: CmsWindowSnapshot) => {
      // Stored rows are enough to render immediately; live CMS sync continues in the background.
      // Reflect the shared refresh state even when cached rows remain visible.
      // This keeps the Refresh button disabled/spinning consistently with Overview.
      setLoading(refreshing);
      setMessage(error ?? "");
      if (cache && cache !== shownCache) {
        shownCache = cache;
        setDataTill(cache.coverage.at(-1)?.endDate ?? null);
        setWarnings(cache.warnings ?? []);
        setLivePlatforms([...new Set(cache.transactions.map((t) => t.provider).filter((id): id is string => !!id))].sort());
        void applyCache(filterCache(cache), shownPlatforms);
      }
    };
    sync(getCmsWindowSnapshot());
    const unsubscribe = subscribeCmsWindow(sync);
    if (!windowRequested.current) {
      windowRequested.current = true;
      void requestCmsWindow();
    }
    return unsubscribe;
  }, [applyCache, filterCache, shownPlatforms, setLivePlatforms]);
  return { baseDashboard, setBaseDashboard, platformMetrics, setPlatformMetrics, allTransactions, setAllTransactions, activeTransactions, setActiveTransactions, active, setActive, activeTransactionIds, setActiveTransactionIds, cpoMobileNumbers, setCpoMobileNumbers, loading, setLoading, message, setMessage, dataTill, setDataTill, warnings, applyCache };
}

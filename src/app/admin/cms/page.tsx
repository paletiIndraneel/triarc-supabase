"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, RefreshCw } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

type Dashboard = {
  summary: Record<string, unknown>;
  chart: Record<string, unknown>;
  chargers: Record<string, unknown>;
  locations: Record<string, unknown>;
};

type Transaction = {
  id: string;
  transactionId: string;
  chargerId: string;
  startedAt: string | null;
  stoppedAt: string | null;
  userName: string;
  mobile: string | null;
  location: string;
  chargerName: string;
  stationType: string | null;
  stopReason: string | null;
  energyKwh: number | null;
};

type TransactionResponse = {
  transactions?: Transaction[];
  count?: number;
};

type ActiveTransactionResponse = {
  count?: number;
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value) / 1000);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CmsOperatorDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [dashboardResponse, transactionsResponse, activeResponse] =
        await Promise.all([
          fetch("/api/cms/dashboard", { cache: "no-store" }),
          fetch(`/api/cms/transactions?page=${page}&perPage=25`, {
            cache: "no-store",
          }),
          fetch("/api/cms/active-transactions", { cache: "no-store" }),
        ]);

      if (!dashboardResponse.ok) {
        throw new Error(await dashboardResponse.text());
      }
      if (!transactionsResponse.ok) {
        throw new Error(await transactionsResponse.text());
      }
      if (!activeResponse.ok) {
        throw new Error(await activeResponse.text());
      }

      const [dashboardData, transactionData, activeData] = await Promise.all([
        dashboardResponse.json() as Promise<Dashboard>,
        transactionsResponse.json() as Promise<TransactionResponse>,
        activeResponse.json() as Promise<ActiveTransactionResponse>,
      ]);

      setDashboard(dashboardData);
      setTransactions(transactionData.transactions ?? []);
      setCount(transactionData.count ?? 0);
      setActive(activeData.count ?? 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CMS request failed.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = dashboard?.summary ?? {};
  const details =
    summary.transactionDetails &&
    typeof summary.transactionDetails === "object"
      ? (summary.transactionDetails as Record<string, unknown>)
      : {};

  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-12 text-white sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
            >
              <ArrowLeft size={16} /> Admin
            </Link>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              CMS Operator Dashboard
            </h1>
            <p className="mt-2 text-sm text-white/60">
              ChargeMOD Power Line operational data, proxied securely through TriArc.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {message && (
          <GlassCard className="mt-6 border-red-400/20 p-5">
            <p className="text-sm text-red-200">{message}</p>
            <p className="mt-2 text-xs text-white/50">
              Check the Cloudflare CMS runtime variables/secrets before troubleshooting the CMS API.
            </p>
          </GlassCard>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Transactions" value={String(summary.transactionCount ?? 0)} />
          <Metric label="Chargers" value={String(summary.chargerCount ?? 0)} />
          <Metric label="Locations" value={String(Array.isArray(dashboard?.locations?.result) ? dashboard?.locations?.result.length : 0)} />
          <Metric label="Active now" value={String(active)} accent />
          <Metric
            label="Total energy"
            value={`${(num(details.totalEnergy) / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`}
          />
          <Metric label="Total revenue" value={money(details.totalRevenue)} />
          <Metric
            label="Total duration"
            value={formatDuration(num(details.totalTime))}
          />
          <Metric
            label="Live state"
            value={active > 0 ? "Charging" : "Idle"}
            accent={active > 0}
          />
        </div>

        <GlassCard className="mt-6 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="font-bold">Transactions</h2>
              <p className="text-xs text-white/50">{count} matching transactions</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Activity size={14} />
              Active: {active}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Charger</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Energy</th>
                  <th className="px-4 py-3">Stop reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-emerald-200">
                      {transaction.transactionId || transaction.chargerId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/70">
                      {formatDate(transaction.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div>{transaction.userName}</div>
                      {transaction.mobile && (
                        <div className="text-xs text-white/40">{transaction.mobile}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">{transaction.location}</td>
                    <td className="px-4 py-3 text-white/70">{transaction.chargerName}</td>
                    <td className="px-4 py-3">{transaction.stationType ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">
                      {transaction.energyKwh == null
                        ? "—"
                        : `${transaction.energyKwh.toFixed(2)} kWh`}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {transaction.stopReason ?? "—"}
                    </td>
                  </tr>
                ))}
                {!loading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-white/40">
                      No transactions returned for the current period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <span className="text-xs text-white/50">
              Page {page} of {Math.max(1, Math.ceil(count / 25))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.max(1, Math.ceil(count / 25)) || loading}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <GlassCard className="p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-emerald-300" : "text-white"}`}>
        {value}
      </p>
    </GlassCard>
  );
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

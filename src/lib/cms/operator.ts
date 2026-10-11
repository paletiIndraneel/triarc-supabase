import { getCloudflareContext } from "@opennextjs/cloudflare";

type CmsConfig = {
  enabled: boolean;
  apiUrl: string;
  username: string;
  password: string;
  locationId: number;
};

type CmsContext = {
  organizationId: string;
  projectId: string;
};

type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;
let cachedContext: CmsContext | null = null;
let tokenRefreshPromise: Promise<string> | null = null;
let contextDiscoveryPromise: Promise<CmsContext> | null = null;
let cachedAllowedLocationIds: number[] | null = null;

const TOKEN_TTL_MS = 45 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;

async function getRuntimeEnv(): Promise<Record<string, unknown>> {
  try {
    const context = await getCloudflareContext({ async: true });
    return context.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

export async function getCmsConfig(): Promise<CmsConfig> {
  const env = await getRuntimeEnv();

  return {
    enabled:
      String(env.CMS_OPERATOR_DASHBOARD_ENABLED ?? "").toLowerCase() === "true",
    apiUrl: String(env.CMS_API_URL ?? "").replace(/\/$/, ""),
    username: String(env.CMS_API_USERNAME ?? ""),
    password: String(env.CMS_API_PASSWORD ?? ""),
    locationId: Number(env.CMS_API_LOCATION_ID ?? 0),
  };
}

async function login(config: CmsConfig): Promise<string> {
  if (
    !config.apiUrl ||
    !config.username ||
    !config.password
  ) {
    throw new Error("CMS runtime configuration is incomplete.");
  }

  const response = await fetch(
    "https://ogs.console.chargemod.com/web/register/signin",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: config.username,
        password: config.password,
      }),
      cache: "no-store",
    }
  );

  if (response.status === 409) {
    const payload = (await response.json().catch(() => null)) as
      | {
          status?: unknown;
          message?: unknown;
          sessions?: unknown;
        }
      | null;

    if (payload?.status === "DEVICE_LIMIT_REACHED") {
      try {
        await removeNodeSessionsFromDeviceLimit(
          payload,
          cachedToken?.value ?? null
        );
        return login(config);
      } catch (error) {
        console.error("[cms] ChargeMOD device limit cleanup failed", error);
        throw new Error(
          "ChargeMOD device limit reached. Please free a slot and try again."
        );
      }
    }
  }

  if (!response.ok) {
    throw new Error(`CMS login failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const token = findToken(payload);
  const discoveredLocationIds = findLocationIds(payload);
  cachedAllowedLocationIds = discoveredLocationIds.length > 0 ? discoveredLocationIds : null;

  if (!token) {
    throw new Error("CMS login succeeded but no bearer token was returned.");
  }

  cachedToken = {
    value: token,
    expiresAt: getTokenExpiry(token) ?? Date.now() + TOKEN_TTL_MS,
  };
  cachedContext = null;
  contextDiscoveryPromise = null;

  return token;
}

async function removeNodeSessionsFromDeviceLimit(
  payload: { sessions?: unknown },
  token: string | null
) {
  if (!token) {
    throw new Error(
      "CMS device limit reached, but no active server token is available to remove the existing node sessions."
    );
  }

  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const nodeSessions = sessions.filter((session): session is Record<string, unknown> => {
    if (!session || typeof session !== "object") return false;
    const deviceInfo = (session as Record<string, unknown>).deviceInfo;
    return (
      Boolean(deviceInfo) &&
      typeof deviceInfo === "object" &&
      String((deviceInfo as Record<string, unknown>).userAgent ?? "")
        .trim()
        .toLowerCase() === "node"
    );
  });

  for (const session of nodeSessions) {
    const sessionId =
      typeof session.sessionId === "string" ? session.sessionId : "";

    if (!sessionId) continue;

    const response = await fetch(
      "https://ogs.console.chargemod.com/web/register/logout-device",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `CMS could not remove node session ${sessionId} (HTTP ${response.status}): ${detail.slice(0, 200)}`
      );
    }
  }
}

function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { exp?: unknown };

    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp)
      ? parsed.exp * 1000
      : null;
  } catch {
    return null;
  }
}

function findLocationIds(value: unknown): number[] {
  const found = new Set<number>();

  function visit(current: unknown) {
    if (!current || typeof current !== "object") return;

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    const object = current as Record<string, unknown>;

    for (const key of ["allowedLocations", "allowedLocationIds", "locationIds"]) {
      const candidate = object[key];
      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          const id =
            typeof item === "number"
              ? item
              : typeof item === "string"
                ? Number(item)
                : item && typeof item === "object"
                  ? Number(
                      (item as Record<string, unknown>).locationId ??
                        (item as Record<string, unknown>)._id
                    )
                  : NaN;

          if (Number.isFinite(id) && id > 0) found.add(id);
        }
      }
    }

    Object.values(object).forEach(visit);
  }

  visit(value);
  return Array.from(found);
}

function findToken(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const object = value as Record<string, unknown>;
  for (const key of ["accessToken", "access_token", "token", "bearerToken"]) {
    if (typeof object[key] === "string" && object[key]) return object[key];
  }

  for (const key of ["data", "result", "user"]) {
    const nested = object[key];
    const found = findToken(nested);
    if (found) return found;
  }

  return null;
}

async function getToken(config: CmsConfig) {
  const now = Date.now();

  // All CMS API requests use this same cached token until it is close to expiry.
  if (
    cachedToken &&
    cachedToken.expiresAt > now + TOKEN_REFRESH_SKEW_MS
  ) {
    return cachedToken.value;
  }

  // If several CMS requests arrive together, only one login request is made.
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = login(config).finally(() => {
    tokenRefreshPromise = null;
  });

  return tokenRefreshPromise;
}

function invalidateToken(token: string) {
  // Never clear a newer token installed by another concurrent request.
  if (cachedToken?.value === token) {
    cachedToken = null;
    cachedContext = null;
    contextDiscoveryPromise = null;
    cachedAllowedLocationIds = null;
  }
}

async function cmsFetch<T>(
  config: CmsConfig,
  baseUrl: string,
  path: string,
  init: RequestInit,
  retry = true
): Promise<T> {
  const token = await getToken(config);

  const requestHeaders = new Headers(init.headers);
  // The captured ChargeMOD browser requests use the same access token with
  // the Bearer scheme for both CMS and OCPI endpoints.
  if (!requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });

  if (response.status === 401 && retry) {
    invalidateToken(token);
    return cmsFetch<T>(config, baseUrl, path, init, false);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `CMS API ${response.status}: ${detail.slice(0, 300)}`
    );
  }

  return response.json() as Promise<T>;
}

async function discoverContext(config: CmsConfig): Promise<CmsContext> {
  if (cachedContext) return cachedContext;
  if (contextDiscoveryPromise) return contextDiscoveryPromise;

  contextDiscoveryPromise = discoverContextInternal(config).finally(() => {
    contextDiscoveryPromise = null;
  });

  return contextDiscoveryPromise;
}

async function discoverContextInternal(config: CmsConfig): Promise<CmsContext> {
  type Organization = {
    _id?: unknown;
    isActive?: unknown;
    isSuspended?: unknown;
    organisationProjects?: unknown;
  };

  type OrganizationsResponse = {
    foundOrganisation?: Organization[];
  };

  type ProjectsResponse = {
    projects?: Array<{
      _id?: unknown;
      projectName?: unknown;
    }>;
  };

  const organizations = await cmsFetch<OrganizationsResponse>(
    config,
    "https://ogs.console.chargemod.com",
    "/web/org/get-organizations",
    {
      method: "GET",
      headers: { accept: "application/json" },
    }
  );

  const candidates = Array.isArray(organizations.foundOrganisation)
    ? organizations.foundOrganisation
    : [];

  for (const organization of candidates) {
    const organizationId =
      typeof organization._id === "string" ? organization._id : "";

    if (
      !organizationId ||
      organization.isActive === false ||
      organization.isSuspended === true
    ) {
      continue;
    }

    const projects = await cmsFetch<ProjectsResponse>(
      config,
      "https://ogs.console.chargemod.com",
      "/web/org/organisation/get-project",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      }
    );

    const powerLineProject = projects.projects?.find(
      (project) =>
        typeof project._id === "string" &&
        typeof project.projectName === "string" &&
        project.projectName.trim().toLowerCase() === "powerline"
    );

    if (powerLineProject && typeof powerLineProject._id === "string") {
      cachedContext = {
        organizationId,
        projectId: powerLineProject._id,
      };
      return cachedContext;
    }
  }

  throw new Error("CMS PowerLine organization/project could not be discovered.");
}

async function getCmsContext(config: CmsConfig): Promise<CmsContext> {
  return discoverContext(config);
}

async function getAllowedLocationIds(
  config: CmsConfig,
  context: CmsContext
): Promise<number[]> {
  if (cachedAllowedLocationIds?.length) return cachedAllowedLocationIds;

  try {
    const response = await cmsPost<Record<string, unknown>>(
      config,
      context,
      `/location/all-locations/?organizationId=${context.organizationId}&projectId=${context.projectId}&offset=1&limit=100&location=&other=`,
      { allowedLocations: [] }
    );

    const ids = findLocationIds(response);
    if (ids.length > 0) {
      cachedAllowedLocationIds = ids;
      return ids;
    }

    const result = Array.isArray(response.result) ? response.result : [];
    const resultIds = result
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => Number(item.locationId))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (resultIds.length > 0) {
      cachedAllowedLocationIds = Array.from(new Set(resultIds));
      return cachedAllowedLocationIds;
    }
  } catch (error) {
    console.error("[cms] ChargeMOD location discovery failed.", error);
    throw new Error(
      "ChargeMOD locations could not be retrieved. No allowed location IDs were returned, so TriArc stopped instead of using a stale or configured location ID."
    );
  }

  throw new Error(
    "ChargeMOD locations could not be retrieved. No allowed location IDs were returned, so TriArc stopped instead of using a stale or configured location ID."
  );
}

export async function getOperatorData(
  config: CmsConfig,
  transactionOptions: {
    page: number;
    perPage: number;
    startDate: string;
    endDate: string;
    searchField?: string;
    searchKey?: string;
  }
) {
  // CMS is the primary transaction source. An OCPI authorization/API failure
  // must not discard valid CMS dashboard or transaction data.
  const ocpiErrors: string[] = [];
  const safeOcpiFetch = async <T,>(label: string, request: () => Promise<T>): Promise<T | { result: unknown[] }> => {
    try {
      return await request();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cms] OCPI ${label} request failed:`, message);
      ocpiErrors.push(`${label}: ${message}`);
      return { result: [] };
    }
  };

  const [dashboard, transactions, active, ocpi, ocpiActive] = await Promise.all([
    getDashboardData(config, transactionOptions.startDate, transactionOptions.endDate),
    getTransactions(config, transactionOptions),
    getActiveTransactions(config),
    safeOcpiFetch("transactions", () => getOcpiTransactions(config, transactionOptions)),
    safeOcpiFetch("active transactions", () => getOcpiActiveTransactions(config)),
  ]);

  const collectPages = async (
    firstPage: Record<string, unknown>,
    fetchPage: (page: number) => Promise<Record<string, unknown>>
  ) => {
    const firstResult = Array.isArray(firstPage.result) ? firstPage.result : [];
    const totalCount = Number(firstPage.count ?? firstResult.length);
    const totalPages = Math.max(1, Math.ceil(totalCount / transactionOptions.perPage));
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => fetchPage(index + 2))
    );
    return [
      ...firstResult,
      ...remainingPages.flatMap((pageResult) =>
        Array.isArray(pageResult.result) ? pageResult.result : []
      ),
    ].filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object"
    );
  };

  const [cmsRows, ocpiRows] = await Promise.all([
    collectPages(transactions, (page) => getTransactions(config, { ...transactionOptions, page })),
    collectPages(ocpi, (page) => getOcpiTransactions(config, { ...transactionOptions, page })),
  ]);

  const mergeUnique = (rows: Record<string, unknown>[]) => {
    const merged = new Map<string, ReturnType<typeof sanitizeTransaction>>();
    for (const raw of rows) {
      const transaction = sanitizeTransaction(raw);
      const key = transaction.transactionId || transaction.id;
      if (!key) continue;
      const existing = merged.get(key);
      merged.set(key, existing ? mergeSanitizedTransactions(existing, transaction) : transaction);
    }
    return Array.from(merged.values());
  };

  const uniqueTransactions = mergeUnique([...cmsRows, ...ocpiRows]);
  const activeRows = [
    ...(Array.isArray(active.result) ? active.result : []),
    ...(Array.isArray(ocpiActive.result) ? ocpiActive.result : []),
  ].filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  );
  const activeTransactions = mergeUnique(activeRows);

  return {
    dashboard,
    transactions: {
      transactions: uniqueTransactions,
      count: uniqueTransactions.length,
      totalCount: uniqueTransactions.length,
      page: transactionOptions.page,
      perPage: transactionOptions.perPage,
      coverage: {
        startDate: transactionOptions.startDate,
        endDate: transactionOptions.endDate,
      },
      sources: {
        cms: cmsRows.length,
        ocpi: ocpiRows.length,
      },
      sourceErrors: ocpiErrors,
    },
    active: {
      transactions: activeTransactions,
      count: activeTransactions.length,
      sources: {
        cms: Array.isArray(active.result) ? active.result.length : 0,
        ocpi: Array.isArray(ocpiActive.result) ? ocpiActive.result.length : 0,
      },
    },
  };
}

type TransactionRecord = ReturnType<typeof sanitizeTransaction>;

function mergeSanitizedTransactions(
  existing: TransactionRecord,
  incoming: TransactionRecord
): TransactionRecord {
  const merged = { ...existing } as TransactionRecord;
  for (const [key, value] of Object.entries(incoming)) {
    const current = (merged as unknown as Record<string, unknown>)[key];
    if ((current === null || current === "" || current === "Unknown") && value !== null && value !== "") {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

async function getOcpiTransactions(
  config: CmsConfig,
  options: {
    page: number;
    perPage: number;
    startDate: string;
    endDate: string;
    searchField?: string;
    searchKey?: string;
  }
) {
  const context = await getCmsContext(config);
  const allowedLocations = await getAllowedLocationIds(config, context);
  return cmsFetch<Record<string, unknown>>(
    config,
    "https://ls.console.chargemod.com",
    "/ocpi/ocpi-transactions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: context.organizationId,
        projectId: context.projectId,
        perPageCount: options.perPage,
        pageNumber: options.page,
        filterDate: { startDate: options.startDate, endDate: options.endDate },
        searchValue: {
          searchField: options.searchField ?? "",
          searchKey: options.searchKey ?? "",
        },
        allowedLocations,
        role: "6231",
      }),
    }
  );
}

async function getOcpiActiveTransactions(config: CmsConfig) {
  const context = await getCmsContext(config);
  const allowedLocations = await getAllowedLocationIds(config, context);
  return cmsFetch<Record<string, unknown>>(
    config,
    "https://ls.console.chargemod.com",
    "/ocpi/ocpi-active-transactions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: context.organizationId,
        projectId: context.projectId,
        perPageCount: 25,
        pageNumber: 1,
        allowedLocations,
        searchValue: { searchField: "", searchKey: "" },
        role: "6231",
      }),
    }
  );
}

export async function getDashboardData(
  config: CmsConfig,
  startDate: string,
  endDate: string
) {
  const context = await getCmsContext(config);
  const allowedLocations = await getAllowedLocationIds(config, context);

  const body = {
    allowedLocations,
    filterDate: { startDate, endDate },
    searchValue: {},
    allowedCustomers: [],
  };

  const [summary, chart, chargers, locations] = await Promise.all([
    cmsPost<Record<string, unknown>>(
      config,
      context,
      `/dashboard/get-transaction-data?organizationId=${context.organizationId}&projectId=${context.projectId}`,
      body
    ),
    cmsPost<Record<string, unknown>>(
      config,
      context,
      `/dashboard/get-chart-data?organizationId=${context.organizationId}&projectId=${context.projectId}`,
      {
        ...body,
        isStartYearForGraph: false,
      }
    ),
    cmsPost<Record<string, unknown>>(
      config,
      context,
      "/dashboard/search-data/get-chargers",
      {
        organizationId: context.organizationId,
        projectId: context.projectId,
        allowedLocations,
      }
    ),
    cmsPost<Record<string, unknown>>(
      config,
      context,
      "/dashboard/search-data/get-locations",
      {
        organizationId: context.organizationId,
        projectId: context.projectId,
        allowedLocations,
      }
    ),
  ]);

  return { summary, chart, chargers, locations };
}

async function cmsPost<T>(
  config: CmsConfig,
  context: CmsContext,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  return cmsFetch<T>(config, config.apiUrl, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getTransactions(
  config: CmsConfig,
  options: {
    page: number;
    perPage: number;
    startDate: string;
    endDate: string;
    searchField?: string;
    searchKey?: string;
  }
) {
  const context = await getCmsContext(config);
  const allowedLocations = await getAllowedLocationIds(config, context);

  return cmsPost<Record<string, unknown>>(
    config,
    context,
    "/pwr/charger/get-pwr-transaction",
    {
      organizationId: context.organizationId,
      projectId: context.projectId,
      perPageCount: options.perPage,
      pageNumber: options.page,
      filterDate: {
        startDate: options.startDate,
        endDate: options.endDate,
      },
      searchValue: {
        searchField: options.searchField ?? "",
        searchKey: options.searchKey ?? "",
      },
      allowedLocations,
      transactionType: null,
      sortType: -1,
      solarType: "",
      allowedCustomers: [],
    }
  );
}

export async function getActiveTransactions(config: CmsConfig) {
  const context = await getCmsContext(config);
  const allowedLocations = await getAllowedLocationIds(config, context);

  return cmsPost<Record<string, unknown>>(
    config,
    context,
    "/pwr/charger/get-pwr-active-transaction",
    {
      organizationId: context.organizationId,
      projectId: context.projectId,
      perPageCount: 25,
      pageNumber: 1,
      allowedLocations,
      searchValue: { searchField: "", searchKey: "" },
      sortType: -1,
      solarType: "",
      allowedCustomers: [],
    }
  );
}

export function sanitizeTransaction(raw: Record<string, unknown>) {
  const startValue = toNumber(raw.startValue);
  const stopValue = toNumber(raw.stopValue);

  return {
    id: String(raw._id ?? ""),
    transactionId: String(raw.transactionId ?? ""),
    chargerId: String(raw.identity ?? ""),
    connectorId: toNumber(raw.connectorId),
    startedAt: raw.startAt ?? null,
    stoppedAt: raw.stopAt ?? null,
    userName: String(raw.userName ?? "Unknown"),
    mobile:
      raw.userMobile !== null && raw.userMobile !== undefined && String(raw.userMobile).trim() !== ""
        ? String(raw.userMobile)
        : null,
    userType: raw.userType ? String(raw.userType) : null,
    tagReference: raw.tagReference ? String(raw.tagReference) : null,
    location: String(raw.locationName ?? ""),
    locationId: toNumber(raw.locationId),
    chargerName: String(raw.chargerName ?? ""),
    stationType: raw.stationType ? String(raw.stationType) : null,
    stopReason: raw.stopReason ? String(raw.stopReason) : null,
    energyKwh:
      startValue !== null && stopValue !== null
        ? Math.max(0, stopValue - startValue) / 1000
        : null,
    startSoc: toNumber(raw.startSoc ?? raw.startSoC ?? raw.startSOC),
    endSoc: toNumber(
      raw.endSoc ?? raw.endSoC ?? raw.endSOC ?? raw.stopSoc ?? raw.stopSoC ?? raw.stopSOC
    ),
    vehicleName: raw.vehicleName ? String(raw.vehicleName) : null,
    vehicleNumber: raw.vehicleNumber ? String(raw.vehicleNumber) : null,
    // CMS currentUsedAmount is stored in thousandths of the currency unit.
    // Normalize it to the actual transaction revenue before aggregating/displaying.
    // Keep the source amount in its original units; the dashboard money()
    // formatter converts currentUsedAmount to displayed currency by dividing by 1000.
    tariffAmount: toNumber(
      raw.currentUsedAmount ?? raw.tariffAmount ?? raw.price ?? raw.usedAmount ?? raw["Used Amount"]
    ),
    vat: toNumber(raw.vat),
    invoiceAvailable: Boolean(raw.invoiceAvailable),
    userId: raw.userId ? String(raw.userId) : null,
    vehicleId: raw.vehicleId ? String(raw.vehicleId) : null,
    geoLatitude: toNumber(raw.geoLatitude),
    geoLongitude: toNumber(raw.geoLongitude),
    idTag: raw.idTag ? String(raw.idTag) : null,
    isFree: typeof raw.isFree === "boolean" ? raw.isFree : null,
    baseDeductiveAmount: toNumber(raw.baseDeductiveAmount),
    isAlphaGuaranteed: typeof raw.isAlphaGuaranteed === "boolean" ? raw.isAlphaGuaranteed : null,
    isTimeBasedTariff: typeof raw.isTimeBasedTariff === "boolean" ? raw.isTimeBasedTariff : null,
    startValue,
    stopValue,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getCmsErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "CMS request failed.";
}

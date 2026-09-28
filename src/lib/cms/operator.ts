import { getCloudflareContext } from "@opennextjs/cloudflare";

const ORGANIZATION_ID = "64b793030dd6bb39c1c3e270";
const PROJECT_ID = "6494141957d29409895704d2";
const LOCATION_ID = 1783154310261;

type CmsConfig = {
  enabled: boolean;
  apiUrl: string;
  username: string;
  password: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

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
    enabled: String(env.CMS_OPERATOR_DASHBOARD_ENABLED ?? "").toLowerCase() === "true",
    apiUrl: String(env.CMS_API_URL ?? "").replace(/\/$/, ""),
    username: String(env.CMS_API_USERNAME ?? ""),
    password: String(env.CMS_API_PASSWORD ?? ""),
  };
}

export function cmsLocationId() {
  return LOCATION_ID;
}

async function login(config: CmsConfig): Promise<string> {
  if (!config.apiUrl || !config.username || !config.password) {
    throw new Error("CMS runtime configuration is incomplete.");
  }

  const response = await fetch(
    `${config.apiUrl}/web/register/signin`,
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

  if (!response.ok) {
    throw new Error(`CMS login failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const token = findToken(payload);

  if (!token) {
    throw new Error("CMS login succeeded but no bearer token was returned.");
  }

  cachedToken = {
    value: token,
    expiresAt: Date.now() + 45 * 60 * 1000,
  };

  return token;
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

async function getToken(config: CmsConfig, forceRefresh = false) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  return login(config);
}

async function cmsPost<T>(
  config: CmsConfig,
  path: string,
  body: Record<string, unknown>,
  retry = true
): Promise<T> {
  const token = await getToken(config);

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (response.status === 401 && retry) {
    cachedToken = null;
    return cmsPost<T>(config, path, body, false);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `CMS API ${response.status}: ${detail.slice(0, 300)}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getDashboardData(
  config: CmsConfig,
  startDate: string,
  endDate: string
) {
  const body = {
    allowedLocations: [LOCATION_ID],
    filterDate: { startDate, endDate },
    searchValue: {},
    allowedCustomers: [],
  };

  const [summary, chart, chargers, locations] = await Promise.all([
    cmsPost<Record<string, unknown>>(
      config,
      `/dashboard/get-transaction-data?organizationId=${ORGANIZATION_ID}&projectId=${PROJECT_ID}`,
      body
    ),
    cmsPost<Record<string, unknown>>(
      config,
      `/dashboard/get-chart-data?organizationId=${ORGANIZATION_ID}&projectId=${PROJECT_ID}`,
      {
        ...body,
        isStartYearForGraph: false,
      }
    ),
    cmsPost<Record<string, unknown>>(
      config,
      "/dashboard/search-data/get-chargers",
      {
        organizationId: ORGANIZATION_ID,
        projectId: PROJECT_ID,
        allowedLocations: [LOCATION_ID],
      }
    ),
    cmsPost<Record<string, unknown>>(
      config,
      "/dashboard/search-data/get-locations",
      {
        organizationId: ORGANIZATION_ID,
        projectId: PROJECT_ID,
        allowedLocations: [LOCATION_ID],
      }
    ),
  ]);

  return { summary, chart, chargers, locations };
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
  return cmsPost<Record<string, unknown>>(
    config,
    "/pwr/charger/get-pwr-transaction",
    {
      organizationId: ORGANIZATION_ID,
      projectId: PROJECT_ID,
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
      allowedLocations: [LOCATION_ID],
      transactionType: null,
      sortType: -1,
      solarType: "",
      allowedCustomers: [],
    }
  );
}

export async function getActiveTransactions(config: CmsConfig) {
  return cmsPost<Record<string, unknown>>(
    config,
    "/pwr/charger/get-pwr-active-transaction",
    {
      organizationId: ORGANIZATION_ID,
      projectId: PROJECT_ID,
      perPageCount: 25,
      pageNumber: 1,
      allowedLocations: [LOCATION_ID],
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
    startedAt: raw.startAt ?? null,
    stoppedAt: raw.stopAt ?? null,
    userName: String(raw.userName ?? "Unknown"),
    mobile: raw.userMobile ? String(raw.userMobile) : null,
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
    vehicleName: raw.vehicleName ? String(raw.vehicleName) : null,
    vehicleNumber: raw.vehicleNumber ? String(raw.vehicleNumber) : null,
    tariffAmount: toNumber(raw.tariffAmount),
    vat: toNumber(raw.vat),
    invoiceAvailable: Boolean(raw.invoiceAvailable),
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

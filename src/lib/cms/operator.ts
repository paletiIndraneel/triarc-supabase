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

let cachedToken: { value: string; expiresAt: number } | null = null;
let cachedContext: CmsContext | null = null;

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
    !config.password ||
    !Number.isFinite(config.locationId) ||
    config.locationId <= 0
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
  cachedContext = null;

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

async function cmsFetch<T>(
  config: CmsConfig,
  baseUrl: string,
  path: string,
  init: RequestInit,
  retry = true
): Promise<T> {
  const token = await getToken(config);

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.status === 401 && retry) {
    cachedToken = null;
    cachedContext = null;
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

export async function getDashboardData(
  config: CmsConfig,
  startDate: string,
  endDate: string
) {
  const context = await getCmsContext(config);

  const body = {
    allowedLocations: [config.locationId],
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
        allowedLocations: [config.locationId],
      }
    ),
    cmsPost<Record<string, unknown>>(
      config,
      context,
      "/dashboard/search-data/get-locations",
      {
        organizationId: context.organizationId,
        projectId: context.projectId,
        allowedLocations: [config.locationId],
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
      allowedLocations: [config.locationId],
      transactionType: null,
      sortType: -1,
      solarType: "",
      allowedCustomers: [],
    }
  );
}

export async function getActiveTransactions(config: CmsConfig) {
  const context = await getCmsContext(config);

  return cmsPost<Record<string, unknown>>(
    config,
    context,
    "/pwr/charger/get-pwr-active-transaction",
    {
      organizationId: context.organizationId,
      projectId: context.projectId,
      perPageCount: 25,
      pageNumber: 1,
      allowedLocations: [config.locationId],
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

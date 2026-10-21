// Shapes of a charging session at each step: ChargeMOD's API -> sanitizeTransaction ->
// the dashboard / the sessions table (SESSIONS_TABLE in ./transactionStore).

// One session as ChargeMOD's transaction list returns it (CMS rows; OCPI rows differ and
// are read through the index signature). Values are as received, so most are loosely typed.
export interface ChargeModTransaction {
  [key: string]: unknown;
  _id?: string;
  __v?: number;
  transactionId?: string;
  identity?: string; // charger ID, e.g. "CMOD0333"
  chargerName?: string;
  connectorId?: number;
  locationId?: number;
  locationName?: string;
  organizationId?: string;
  projectId?: string;
  stationType?: string; // "AC" | "DC"
  solarType?: string;
  type?: string; // e.g. "WALLET", "CPO"
  startAt?: string;
  stopAt?: string;
  stopReason?: string;
  startValue?: number; // meter reading, Wh
  stopValue?: number; // meter reading, Wh
  startSOC?: string; // "" or "-" when the charger doesn't report it
  stopSOC?: string;
  currentUsedAmount?: number; // thousandths of INR
  tariffAmount?: number; // per-kWh rate on CMS rows
  vat?: number;
  baseDeductiveAmount?: number;
  startingBalance?: unknown;
  endingBalance?: number;
  isFree?: boolean;
  isAlphaGuaranteed?: boolean;
  isTimeBasedTariff?: boolean;
  idTag?: string;
  tagReferenceNo?: string; // "Nill" when there is none
  invoiceLink?: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  userEmail?: string;
  email?: string;
  userType?: Array<{ _id?: string; typeName?: string }>;
  vehicleId?: string;
  vehicleModelId?: string;
  vehicleName?: string;
  vehicleNumber?: string;
  geoLocation?: { type?: string; coordinates?: [number, number] }; // [longitude, latitude]
  // Never stored: it carries the customer's ChargeMOD refresh and FCM tokens.
  employeeDetails?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

// A session after sanitizeTransaction: what /api/cms/operator returns and the dashboard uses.
export type CmsTransaction = {
  provider: string; // the charging platform's id (./providerIds), e.g. "chargemod"
  id: string;
  transactionId: string;
  chargerId: string;
  connectorId: number | null;
  startedAt: string | null;
  stoppedAt: string | null; // null while still charging
  userName: string;
  mobile: string | null;
  userType: string | null;
  tagReference: string | null;
  location: string;
  locationId: number | null;
  chargerName: string;
  stationType: string | null;
  type: string | null;
  stopReason: string | null;
  energyKwh: number | null;
  startSoc: number | null;
  endSoc: number | null;
  vehicleName: string | null;
  vehicleNumber: string | null;
  tariffAmount: number | null; // INR charged for the session
  vat: number | null;
  invoiceAvailable: boolean;
  userId: string | null;
  vehicleId: string | null;
  geoLatitude: number | null;
  geoLongitude: number | null;
  idTag: string | null;
  isFree: boolean | null;
  baseDeductiveAmount: number | null;
  isAlphaGuaranteed: boolean | null;
  isTimeBasedTariff: boolean | null;
  startValue: number | null;
  stopValue: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  invoiceLink: string | null;
  organizationId: string | null;
  projectId: string | null;
  solarType: string | null;
  userEmail: string | null;
  vehicleModelId: string | null;
  startingBalance: number | null;
  endingBalance: number | null;
};

type SnakeCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? `${Head extends Uppercase<Head> ? (Head extends Lowercase<Head> ? Head : `_${Lowercase<Head>}`) : Head}${SnakeCase<Tail>}`
  : S;

// A sessions-table row: every CmsTransaction field in snake_case, plus when we saved it.
export type CmsTransactionRow = {
  [K in keyof CmsTransaction as SnakeCase<K>]: CmsTransaction[K];
} & { synced_at: string };

// Live session metrics worked out from a session's OCPP meter values (ChargeMOD meter-values).
// Pure: no network or React, so it is unit-tested on real captured sessions.

export type MeterReading = {
  timestamp: string; // ISO time of the reading
  measurand: string; // e.g. "SoC", "Power.Active.Import", "Energy.Active.Import.Register"
  value: number;
  unit: string | null;
};

export type LiveMetrics = {
  startSoc: number | null;
  currentSoc: number | null;
  kwNow: number | null;
  peakKw: number | null;
  kwhDelivered: number | null;
  // Battery, kWh to full and time left stay null ("estimating…") until SoC has risen enough.
  batteryKwh: number | null;
  kwhToFull: number | null;
  minutesLeft: number | null;
  estimating: boolean;
  lastReadingAt: string | null;
};

// Battery size is only trusted once SoC (whole percent) has risen this much.
export const MIN_SOC_RISE = 5;

// Power steps seen on the DC chargers near full (28.8 -> 17.3 -> 8.6 kW).
const TAPER: Array<[socFrom: number, factor: number]> = [
  [96, 0.3],
  [90, 0.6],
];

type ReadingSet = {
  timestamp: string;
  soc: number | null;
  powerKw: number | null;
  energyWh: number | null;
};

// ChargeMOD sends repeated readings and can repeat timestamp/measurand pairs. Preserve every
// row in the list; Voltage and Current.Import repeat per phase, so use Power.Active.Import.
function readingSets(readings: MeterReading[]): ReadingSet[] {
  // Preserve every reading in an array; a Map would discard duplicate timestamp/measurand pairs.
  return readings
    .filter((r) => Number.isFinite(r.value) && Number.isFinite(Date.parse(r.timestamp)))
    .map((r) => {
      const set: ReadingSet = { timestamp: r.timestamp, soc: null, powerKw: null, energyWh: null };
      // CMS/charger payloads are not consistent about measurand casing or whitespace.
      // Normalize before matching so "soc", "SOC", and "SoC" all reach the UI.
      const measurand = r.measurand.trim().toLowerCase();
      if (measurand === "soc" || measurand === "stateofcharge" || measurand === "state_of_charge") {
        set.soc = r.value;
      } else if (measurand === "power.active.import") {
        set.powerKw = /^w$/i.test(r.unit ?? "") ? r.value / 1000 : r.value;
      } else if (measurand === "energy.active.import.register") {
        set.energyWh = /kwh/i.test(r.unit ?? "") ? r.value * 1000 : r.value;
      }
      return set;
    })
    .sort((x, y) => Date.parse(x.timestamp) - Date.parse(y.timestamp));
}

function minutesToFull(soc: number, batteryKwh: number, kw: number) {
  // Walk the SoC bands from the current SoC to 100%, with power reduced above 90% and 96%.
  const bands = [soc, ...TAPER.map(([from]) => from).filter((from) => from > soc).reverse(), 100];
  let minutes = 0;
  for (let i = 0; i < bands.length - 1; i += 1) {
    const from = bands[i];
    const to = bands[i + 1];
    const factor = TAPER.find(([start]) => from >= start)?.[1] ?? 1;
    minutes += (((to - from) / 100) * batteryKwh) / (kw * factor) * 60;
  }
  return minutes;
}

export function liveMetrics(readings: MeterReading[]): LiveMetrics {
  const sets = readingSets(readings);
  const empty: LiveMetrics = {
    startSoc: null, currentSoc: null, kwNow: null, peakKw: null, kwhDelivered: null,
    batteryKwh: null, kwhToFull: null, minutesLeft: null, estimating: true, lastReadingAt: null,
  };
  if (!sets.length) return empty;

  // Start values come from the earliest available readings. Current power uses the newest
  // valid power sample, including 0 kW; peak power is the highest non-negative sample returned.
  const first = sets.find((s) => s.soc != null || s.energyWh != null) ?? sets[0];
  const last = sets[sets.length - 1];
  const startSoc = sets.find((s) => s.soc != null)?.soc ?? null;
  const currentSoc = [...sets].reverse().find((s) => s.soc != null)?.soc ?? null;
  const startWh = sets.find((s) => s.energyWh != null)?.energyWh ?? first.energyWh;
  const lastWh = [...sets].reverse().find((s) => s.energyWh != null)?.energyWh ?? null;
  const kwNow = [...sets].reverse().find((s) => s.powerKw != null)?.powerKw ?? null;
  const powerSamples = sets.map((s) => s.powerKw).filter((kw): kw is number => kw != null && kw >= 0);
  const peakKw = powerSamples.length ? Math.max(...powerSamples) : null;

  const kwhDelivered = startWh != null && lastWh != null ? Math.max(0, (lastWh - startWh) / 1000) : null;
  const rise = startSoc != null && currentSoc != null ? currentSoc - startSoc : 0;
  const estimating = !(rise >= MIN_SOC_RISE && kwhDelivered);

  let batteryKwh: number | null = null;
  let kwhToFull: number | null = null;
  let minutesLeft: number | null = null;
  if (!estimating && kwhDelivered && currentSoc != null) {
    batteryKwh = (kwhDelivered / rise) * 100;
    kwhToFull = ((100 - currentSoc) * batteryKwh) / 100;
    minutesLeft = kwNow && kwNow > 0 ? minutesToFull(currentSoc, batteryKwh, kwNow) : null;
  }

  return { startSoc, currentSoc, kwNow, peakKw, kwhDelivered, batteryKwh, kwhToFull, minutesLeft, estimating, lastReadingAt: last.timestamp };
}

// ChargeMOD payloads vary: readings may be flat rows or nested OCPP sampledValue arrays.
// Collect every matching row instead of stopping at the first matching array, so a later
// timestamp in another group cannot be silently ignored.
export function parseMeterValues(payload: unknown): MeterReading[] {
  return findRows(payload)
    .map((row) => {
      const measurand = String(row.measurand ?? row.Measurand ?? "");
      const rawValue = row.value ?? row.Value;
      const value = typeof rawValue === "number" || typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
      const time = row.timestamp ?? row.valueTimestamp ?? row.timeStamp ?? row.createdAt;
      let timestamp = "";
      if (time != null && String(time).trim() !== "") {
        const parsed = new Date(String(time));
        if (Number.isFinite(parsed.getTime())) timestamp = parsed.toISOString();
      }
      const rawUnit = row.unit ?? row.Unit;
      return { measurand, value, unit: rawUnit == null ? null : String(rawUnit), timestamp };
    })
    .filter((r) => r.measurand && r.timestamp && Number.isFinite(r.value));
}

function isReadingRow(row: Record<string, unknown>): boolean {
  return ("measurand" in row || "Measurand" in row) && ("value" in row || "Value" in row);
}

function findRows(node: unknown, depth = 0, inheritedTimestamp?: unknown): Array<Record<string, unknown>> {
  if (depth > 10 || !node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    return node.flatMap((item) => findRows(item, depth + 1, inheritedTimestamp));
  }

  const object = node as Record<string, unknown>;
  const ownTimestamp = object.timestamp ?? object.valueTimestamp ?? object.timeStamp ?? object.createdAt ?? inheritedTimestamp;

  if (isReadingRow(object)) {
    // OCPP sampledValue entries inherit the timestamp from their enclosing meterValue.
    return [{ ...object, timestamp: object.timestamp ?? object.valueTimestamp ?? object.timeStamp ?? object.createdAt ?? ownTimestamp }];
  }

  return Object.values(object).flatMap((value) => findRows(value, depth + 1, ownTimestamp));
}

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

// ChargeMOD sends a full set every ~15 s and repeats sets; group by timestamp and keep the
// last value seen for each measurand (Voltage and Current.Import repeat per phase, so they
// are not used: Power.Active.Import already matches DC voltage x DC current).
function readingSets(readings: MeterReading[]): ReadingSet[] {
  const byTime = new Map<string, ReadingSet>();
  for (const r of readings) {
    if (!Number.isFinite(r.value)) continue;
    const set = byTime.get(r.timestamp) ?? { timestamp: r.timestamp, soc: null, powerKw: null, energyWh: null };
    if (r.measurand === "SoC") set.soc = r.value;
    else if (r.measurand === "Power.Active.Import") set.powerKw = /^w$/i.test(r.unit ?? "") ? r.value / 1000 : r.value;
    else if (r.measurand === "Energy.Active.Import.Register") set.energyWh = /kwh/i.test(r.unit ?? "") ? r.value * 1000 : r.value;
    byTime.set(r.timestamp, set);
  }
  return [...byTime.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
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
    startSoc: null, currentSoc: null, kwNow: null, kwhDelivered: null,
    batteryKwh: null, kwhToFull: null, minutesLeft: null, estimating: true, lastReadingAt: null,
  };
  if (!sets.length) return empty;

  // Start values come from the very first set (start-up readings at 0 kW still carry the
  // starting SoC and register); live power ignores 0 kW sets.
  const first = sets.find((s) => s.soc != null || s.energyWh != null) ?? sets[0];
  const last = sets[sets.length - 1];
  const startSoc = sets.find((s) => s.soc != null)?.soc ?? null;
  const currentSoc = [...sets].reverse().find((s) => s.soc != null)?.soc ?? null;
  const startWh = sets.find((s) => s.energyWh != null)?.energyWh ?? first.energyWh;
  const lastWh = [...sets].reverse().find((s) => s.energyWh != null)?.energyWh ?? null;
  const kwNow = [...sets].reverse().find((s) => (s.powerKw ?? 0) > 0)?.powerKw ?? (last.powerKw ?? null);

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

  return { startSoc, currentSoc, kwNow, kwhDelivered, batteryKwh, kwhToFull, minutesLeft, estimating, lastReadingAt: last.timestamp };
}

// Turns a ChargeMOD meter-values response into readings. The exact shape isn't documented, so
// it looks for the first array of objects with a measurand and a value anywhere in the payload.
export function parseMeterValues(payload: unknown): MeterReading[] {
  const rows = findRows(payload);
  return rows
    .map((row) => {
      const measurand = String(row.measurand ?? row.Measurand ?? "");
      const value = Number(row.value ?? row.Value);
      const time = row.timestamp ?? row.valueTimestamp ?? row.timeStamp ?? row.createdAt;
      const timestamp = time ? new Date(String(time)).toISOString() : "";
      return { measurand, value, unit: row.unit != null ? String(row.unit) : null, timestamp };
    })
    .filter((r) => r.measurand && r.timestamp && Number.isFinite(r.value));
}

function findRows(node: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 5 || !node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    const objects = node.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
    if (objects.some((x) => ("measurand" in x || "Measurand" in x) && ("value" in x || "Value" in x))) return objects;
    // OCPP style: [{ timestamp, sampledValue: [{ measurand, value, unit }] }]
    const nested = objects.flatMap((x) => {
      const sampled = x.sampledValue ?? x.sampledValues;
      return Array.isArray(sampled)
        ? sampled.map((s) => ({ timestamp: x.timestamp, ...(s as Record<string, unknown>) }))
        : [];
    });
    if (nested.length) return nested;
    for (const item of objects) {
      const found = findRows(item, depth + 1);
      if (found.length) return found;
    }
    return [];
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findRows(value, depth + 1);
    if (found.length) return found;
  }
  return [];
}

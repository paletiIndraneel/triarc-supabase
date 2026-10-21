// Totals of a platform's charging sessions for a billing period, and the invoice lines they
// suggest. Pure, so it is unit-tested; the bill form only displays it and adds lines on request.

// Billing periods are IST calendar dates, both days included.
export function periodBounds(from, to) {
  const start = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const lastTen = (mobile) => {
  const digits = String(mobile ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
};

// CPO sessions are Triarc's own use: ChargeMOD's type says so, else the CPO Settings numbers.
const isCpo = (row, cpoNumbers) => {
  const type = String(row.type ?? '').trim().toUpperCase();
  if (type) return type === 'CPO';
  const mobile = lastTen(row.mobile);
  return mobile !== null && cpoNumbers.has(mobile);
};

const chargerType = (row) => {
  const text = `${row.station_type ?? ''} ${row.charger_name ?? ''}`.toUpperCase();
  if (/\bDC\b/.test(text)) return 'DC';
  if (/\bAC\b/.test(text)) return 'AC';
  return null;
};

// rows: cms_transactions rows (station_type, charger_name, type, mobile, energy_kwh).
// ChargeMOD bills every session, so CPO sessions count in AC/DC too; `cpo` only says how
// much of those totals they are.
export function summarizeSessions(rows, cpoNumbers = new Set()) {
  const out = { AC: { kwh: 0, sessions: 0 }, DC: { kwh: 0, sessions: 0 }, cpo: { kwh: 0, sessions: 0 }, other: { kwh: 0, sessions: 0 } };
  for (const row of rows) {
    const kwh = Number(row.energy_kwh);
    if (!Number.isFinite(kwh) || kwh <= 0) continue; // failed or empty sessions are not billed
    const buckets = [out[chargerType(row) ?? 'other']];
    if (isCpo(row, cpoNumbers)) buckets.push(out.cpo);
    for (const bucket of buckets) {
      bucket.kwh += kwh;
      bucket.sessions += 1;
    }
  }
  for (const b of Object.values(out)) b.kwh = Math.round(b.kwh * 10000) / 10000;
  return out;
}

// The item for a charger type: the customer's own item first, else a general one.
export function itemFor(inventory, customerId, type) {
  const ofType = inventory.filter((p) => p.charger_type === type);
  return ofType.find((p) => p.customer_id === customerId) ?? ofType.find((p) => !p.customer_id) ?? null;
}

const SOURCE_LABEL = { chargemod: 'ChargeMOD', ather: 'Ather' };
const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
const fmt = (d) => day.format(new Date(`${d}T00:00:00Z`));

// Invoice lines for the AC and DC totals, ready for the items table. Types with no kWh or no
// item are left out (missing items are reported by the caller, never billed at a guessed rate).
export function suggestedLines(summary, inventory, customerId, source, from, to) {
  const label = SOURCE_LABEL[source] ?? source;
  return ['DC', 'AC'].flatMap((type) => {
    const total = summary[type];
    const item = itemFor(inventory, customerId, type);
    if (!total.kwh || !item) return [];
    return [{
      inventory_id: item.id,
      description: `${item.product_name}, ${label} sessions ${fmt(from)} – ${fmt(to)}`,
      hsn: item.hsn || '',
      unit: item.unit || 'KWH',
      quantity: total.kwh,
      unit_price: +item.selling_price || 0,
      gst_rate: +item.gst_rate || 0,
      discount_percent: 0,
      source_kwh: total.kwh,
      source_sessions: total.sessions,
    }];
  });
}

import { NextResponse } from "next/server";

type TelemetryBody = {
  device_id?: string;
  type?: "readings" | "health" | "events" | "heartbeat";
  timestamp?: string;
  payload?: Record<string, unknown>;
};

const allowedTypes = new Set(["readings", "health", "events", "heartbeat"]);

export async function POST(request: Request) {
  const configuredToken = process.env.DEVICE_INGEST_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!configuredToken || !supabaseUrl || !serviceRoleKey) {
    console.error("[device-ingest] Server configuration is incomplete.");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization !== `Bearer ${configuredToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TelemetryBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = body.device_id?.trim();
  const type = body.type;
  const payload = body.payload;

  if (!deviceId || !type || !allowedTypes.has(type) || !payload || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
  }

  const recordedAt = body.timestamp || String(payload.timestamp || payload.recorded_at || new Date().toISOString());

  const device = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `devices?select=id,device_id&device_id=eq.${encodeURIComponent(deviceId)}&limit=1`
  );

  if (!device.ok) {
    console.error("[device-ingest] Device lookup failed:", device.status);
    return NextResponse.json({ error: "Device lookup failed" }, { status: 502 });
  }

  const devices = await device.json();
  if (!Array.isArray(devices) || devices.length !== 1) {
    return NextResponse.json({ error: "Unknown device" }, { status: 404 });
  }

  const statusResponse = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `devices?device_id=eq.${encodeURIComponent(deviceId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "online",
        last_seen: recordedAt,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!statusResponse.ok) {
    console.error("[device-ingest] Device status update failed:", statusResponse.status);
    return NextResponse.json({ error: "Device status update failed" }, { status: 502 });
  }

  if (type === "heartbeat") {
    return NextResponse.json({ ok: true });
  }

  let table: string;
  let row: Record<string, unknown>;

  if (type === "readings") {
    table = "device_readings";
    row = {
      device_id: deviceId,
      recorded_at: recordedAt,
      voltage: numberOrNull(payload.voltage),
      current: numberOrNull(payload.current),
      power: numberOrNull(payload.power),
      energy: numberOrNull(payload.energy),
      frequency: numberOrNull(payload.frequency),
      power_factor: numberOrNull(payload.powerFactor ?? payload.power_factor),
      temperature: numberOrNull(payload.temperature),
      humidity: numberOrNull(payload.humidity),
      internet: booleanOrNull(payload.internet),
    };
  } else if (type === "health") {
    table = "device_health";
    row = {
      device_id: deviceId,
      recorded_at: recordedAt,
      module: stringOrNull(payload.module),
      state: stringOrNull(payload.state),
      message: stringOrNull(payload.message),
    };
  } else {
    table = "device_events";
    row = {
      device_id: deviceId,
      recorded_at: recordedAt,
      event_type: stringOrNull(payload.eventType ?? payload.event_type),
      message: stringOrNull(payload.message),
    };
  }

  const insertResponse = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    table,
    {
      method: "POST",
      body: JSON.stringify(row),
    }
  );

  if (!insertResponse.ok) {
    console.error("[device-ingest] Telemetry insert failed:", insertResponse.status);
    return NextResponse.json({ error: "Telemetry insert failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

async function supabaseRequest(
  baseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {}
) {
  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers || {}),
    },
  });
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
}

function stringOrNull(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

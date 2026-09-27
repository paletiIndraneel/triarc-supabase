import mqtt from "mqtt";
import { createClient } from "@supabase/supabase-js";

const required = [
  "HIVEMQ_HOST",
  "HIVEMQ_USERNAME",
  "HIVEMQ_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const host = process.env.HIVEMQ_HOST;
const port = Number(process.env.HIVEMQ_PORT || 8883);
const clientId = process.env.MQTT_CLIENT_ID || "triarc-telemetry-gateway";
const offlineAfterMs = Number(process.env.OFFLINE_AFTER_SECONDS || 180) * 1000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const topicRoot = "triarc/devices";
const subscriptions = [
  `${topicRoot}/+/readings`,
  `${topicRoot}/+/health`,
  `${topicRoot}/+/events`,
  `${topicRoot}/+/heartbeat`,
];

const lastSeen = new Map();

const mqttClient = mqtt.connect(`mqtts://${host}:${port}`, {
  clientId,
  username: process.env.HIVEMQ_USERNAME,
  password: process.env.HIVEMQ_PASSWORD,
  protocolVersion: 5,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 15000,
  keepalive: 60,
});

mqttClient.on("connect", async () => {
  console.log(`[mqtt] connected to ${host}:${port}`);

  mqttClient.subscribe(subscriptions, { qos: 1 }, (error) => {
    if (error) console.error("[mqtt] subscribe failed:", error);
    else console.log("[mqtt] subscribed:", subscriptions.join(", "));
  });
});

mqttClient.on("reconnect", () => console.log("[mqtt] reconnecting..."));
mqttClient.on("close", () => console.log("[mqtt] connection closed"));
mqttClient.on("error", (error) => console.error("[mqtt] error:", error));

mqttClient.on("message", async (topic, raw) => {
  try {
    const parsed = parseTopic(topic);
    if (!parsed) return;

    const payload = parseJson(raw);
    if (!payload) {
      console.warn(`[mqtt] ignored non-JSON payload on ${topic}`);
      return;
    }

    const { deviceId, kind } = parsed;
    const device = await getDevice(deviceId);

    if (!device) {
      console.warn(`[mqtt] unknown device: ${deviceId}`);
      return;
    }

    const seenAt = new Date().toISOString();
    lastSeen.set(deviceId, Date.now());

    await markOnline(deviceId, seenAt);

    if (kind === "readings") await insertReading(deviceId, payload, seenAt);
    else if (kind === "health") await insertHealth(deviceId, payload, seenAt);
    else if (kind === "events") await insertEvent(deviceId, payload, seenAt);
    else if (kind === "heartbeat") {
      console.log(`[heartbeat] ${deviceId}`);
    }
  } catch (error) {
    console.error(`[mqtt] message processing failed for ${topic}:`, error);
  }
});

setInterval(async () => {
  const cutoff = Date.now() - offlineAfterMs;

  for (const [deviceId, timestamp] of lastSeen) {
    if (timestamp < cutoff) {
      const { error } = await supabase
        .from("devices")
        .update({
          status: "offline",
          updated_at: new Date().toISOString(),
        })
        .eq("device_id", deviceId);

      if (error) console.error(`[status] offline update failed for ${deviceId}:`, error);
      else {
        console.log(`[status] ${deviceId} -> offline`);
        lastSeen.delete(deviceId);
      }
    }
  }
}, 30000);

function parseTopic(topic) {
  const parts = topic.split("/");
  if (parts.length !== 4) return null;
  if (parts[0] !== "triarc" || parts[1] !== "devices") return null;
  return { deviceId: parts[2], kind: parts[3] };
}

function parseJson(raw) {
  try {
    const value = JSON.parse(raw.toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function getDevice(deviceId) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, device_id")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function markOnline(deviceId, seenAt) {
  const { error } = await supabase
    .from("devices")
    .update({
      status: "online",
      last_seen: seenAt,
      updated_at: seenAt,
    })
    .eq("device_id", deviceId);

  if (error) throw error;
}

async function insertReading(deviceId, payload, seenAt) {
  const row = {
    device_id: deviceId,
    recorded_at: payload.timestamp || payload.recorded_at || seenAt,
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

  const { error } = await supabase.from("device_readings").insert(row);
  if (error) throw error;
}

async function insertHealth(deviceId, payload, seenAt) {
  const { error } = await supabase.from("device_health").insert({
    device_id: deviceId,
    recorded_at: payload.timestamp || payload.recorded_at || seenAt,
    module: stringOrNull(payload.module),
    state: stringOrNull(payload.state),
    message: stringOrNull(payload.message),
  });

  if (error) throw error;
}

async function insertEvent(deviceId, payload, seenAt) {
  const { error } = await supabase.from("device_events").insert({
    device_id: deviceId,
    recorded_at: payload.timestamp || payload.recorded_at || seenAt,
    event_type: stringOrNull(payload.eventType ?? payload.event_type),
    message: stringOrNull(payload.message),
  });

  if (error) throw error;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
}

function stringOrNull(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

process.on("SIGTERM", () => {
  console.log("[gateway] shutting down");
  mqttClient.end(true, () => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("[gateway] shutting down");
  mqttClient.end(true, () => process.exit(0));
});

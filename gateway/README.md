# TriArc Telemetry Gateway

The gateway is a server-side MQTT subscriber. It receives telemetry from HiveMQ Cloud and writes validated records to Supabase.

## Security

HiveMQ credentials and the Supabase service-role key are environment secrets only.

Do not:
- commit `.env`
- put HiveMQ credentials in the Next.js app
- put HiveMQ credentials in `public/`
- store MQTT passwords in `public.devices`
- expose `SUPABASE_SERVICE_ROLE_KEY` to the browser

## Runtime flow

ESP32-S3 -> HiveMQ Cloud -> this gateway -> Supabase -> Supabase Realtime -> /admin

## Required environment

Copy `.env.example` to `.env` for local development and provide real values through the hosting platform in staging/production.

The gateway expects MQTT TLS on port 8883 and subscribes to:

- `triarc/devices/+/readings`
- `triarc/devices/+/health`
- `triarc/devices/+/events`
- `triarc/devices/+/heartbeat`

The per-device HiveMQ credential is not reused by the gateway.

## Payload contract

Readings:
```json
{
  "timestamp": "2026-09-27T12:00:00.000Z",
  "voltage": 230.1,
  "current": 4.2,
  "power": 966.4,
  "energy": 12.345,
  "frequency": 50,
  "powerFactor": 0.99,
  "temperature": 31.2,
  "humidity": null,
  "internet": true
}
```

Health:
```json
{
  "timestamp": "2026-09-27T12:00:00.000Z",
  "module": "rtc",
  "state": "ok",
  "message": "RTC initialized"
}
```

Event:
```json
{
  "timestamp": "2026-09-27T12:00:00.000Z",
  "eventType": "boot",
  "message": "Sentinel boot complete"
}
```

Heartbeat may contain any JSON object; receipt updates the device's online/last-seen state.

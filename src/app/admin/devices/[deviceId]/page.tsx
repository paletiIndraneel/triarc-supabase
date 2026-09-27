import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Cpu, HeartPulse, Radio, Server, ShieldCheck, Wifi } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import DeviceManagement from "./DeviceManagement";
import ReadingsTable from "./ReadingsTable";
import LiveTelemetry from "./LiveTelemetry";

export const metadata: Metadata = {
  title: "Device",
  robots: { index: false, follow: false },
};

const mqttTopics = ["readings", "health", "events", "heartbeat", "commands", "config"];

export default async function DeviceDetailsPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const supabase = await createClient();

  const { data: device, error } = await supabase
    .from("devices")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle();

  if (error || !device) notFound();

  const [{ count: readingsCount }, { count: healthCount }, { count: eventsCount }, { data: readings }, { data: health }, { data: events }] =
    await Promise.all([
      supabase.from("device_readings").select("id", { count: "exact", head: true }).eq("device_id", device.device_id),
      supabase.from("device_health").select("id", { count: "exact", head: true }).eq("device_id", device.device_id),
      supabase.from("device_events").select("id", { count: "exact", head: true }).eq("device_id", device.device_id),
      supabase.from("device_readings").select("*").eq("device_id", device.device_id).order("recorded_at", { ascending: false }).limit(50),
      supabase.from("device_health").select("*").eq("device_id", device.device_id).order("recorded_at", { ascending: false }).limit(25),
      supabase.from("device_events").select("*").eq("device_id", device.device_id).order("recorded_at", { ascending: false }).limit(25),
    ]);

  const topicPrefix = device.topic || `triarc/devices/${device.device_id}`;

  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/devices" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          <ArrowLeft size={16} />
          Back to devices
        </Link>

        <header className="mt-5 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Device</p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">{device.name}</h1>
            <p className="mt-2 text-sm text-white/50">{device.device_id} · {device.site_name || "No site"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold capitalize text-white/70">
              {device.status.replace("_", " ")}
            </span>
            <DeviceManagement device={device} />
          </div>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Cpu size={20} />} label="Hardware" value={device.device_type === "esp32_s3" ? "ESP32-S3" : "Pi 5"} />
          <Stat icon={<Radio size={20} />} label="Connection" value={device.connection_type.toUpperCase()} />
          <Stat icon={<Activity size={20} />} label="Readings" value={String(readingsCount ?? 0)} />
          <Stat icon={<HeartPulse size={20} />} label="Health records" value={String(healthCount ?? 0)} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <GlassCard className="p-6 lg:col-span-2">
            <div className="flex items-center gap-3">
              <Server className="text-emerald-300" size={22} />
              <h2 className="text-lg font-bold text-white">Overview</h2>
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <Detail label="Device ID" value={device.device_id} />
              <Detail label="Site" value={device.site_name || "—"} />
              <Detail label="Firmware" value={device.firmware_version || "—"} />
              <Detail label="Last seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : "Never"} />
              <Detail label="Endpoint" value={device.endpoint || "Not configured"} />
              <Detail label="Topic prefix" value={topicPrefix} />
            </dl>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-white">Telemetry</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">Historical data is stored in the three Supabase telemetry tables.</p>
            <div className="mt-5 space-y-3 text-sm">
              <Row label="Readings" value={readingsCount ?? 0} />
              <Row label="Health" value={healthCount ?? 0} />
              <Row label="Events" value={eventsCount ?? 0} />
            </div>
          </GlassCard>
        </div>

        <GlassCard className="mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Wifi className="text-emerald-300" size={22} />
                <h2 className="text-lg font-bold text-white">MQTT Communication</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Device communication is prepared for HiveMQ Cloud over MQTT with TLS. Credentials are intentionally not stored in the device record.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <ShieldCheck size={14} />
              TLS required
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CommunicationValue label="Protocol" value={device.connection_type.toUpperCase()} />
            <CommunicationValue label="TLS port" value={String(device.port || 8883)} />
            <CommunicationValue label="Broker" value={device.endpoint || "Not configured"} />
            <CommunicationValue label="Topic prefix" value={topicPrefix} />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Device topics</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mqttTopics.map((suffix) => (
                <code key={suffix} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70">
                  {topicPrefix}/{suffix}
                </code>
              ))}
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-white/40">
            MQTT credentials stay in the device firmware/provisioning path. The admin UI only stores non-secret connection metadata.
          </p>
        </GlassCard>

        <GlassCard className="mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Live Data</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Updates from Supabase Realtime when the gateway receives a new MQTT reading.
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              Realtime
            </span>
          </div>
          <LiveTelemetry
            deviceId={device.device_id}
            initialReading={readings?.[0] ? {
              recorded_at: readings[0].recorded_at,
              voltage: readings[0].voltage,
              current: readings[0].current,
              power: readings[0].power,
              energy: readings[0].energy,
            } : null}
          />
        </GlassCard>

        <GlassCard className="mt-4 p-6">
          <h2 className="text-lg font-bold text-white">Recent readings</h2>
          <p className="mt-1 text-sm text-white/50">Latest 50 records.</p>
          <div className="mt-5">
            {readings?.length ? <ReadingsTable readings={readings} /> : <Empty text="No readings have been received yet." />}
          </div>
        </GlassCard>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-white">Health</h2>
            <div className="mt-4 space-y-3">
              {health?.length ? health.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-white">{item.module || "System"}</span>
                    <span className="text-xs capitalize text-white/50">{item.state || "—"}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">{item.message || "—"}</p>
                  <p className="mt-2 text-xs text-white/30">{new Date(item.recorded_at).toLocaleString()}</p>
                </div>
              )) : <Empty text="No health records have been received yet." />}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-white">Events</h2>
            <div className="mt-4 space-y-3">
              {events?.length ? events.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-white">{item.event_type || "Event"}</span>
                    <span className="text-xs text-white/30">{new Date(item.recorded_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">{item.message || "—"}</p>
                </div>
              )) : <Empty text="No events have been received yet." />}
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <div className="text-emerald-300">{icon}</div>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </GlassCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-[0.15em] text-white/40">{label}</dt><dd className="mt-1 break-all text-sm text-white/80">{value}</dd></div>;
}

function CommunicationValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-white/80">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"><span className="text-white/50">{label}</span><span className="font-semibold text-white">{value}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">{text}</p>;
}

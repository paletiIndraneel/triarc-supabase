import type { Metadata } from "next";
import Link from "next/link";
import { Cpu, Plus, Wifi, ArrowRight } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Devices",
  robots: { index: false, follow: false },
};

export default async function DevicesPage() {
  const supabase = await createClient();

  const { data: devices, error } = await supabase
    .from("devices")
    .select(
      "id, name, site_name, device_type, device_id, connection_type, status, last_seen, firmware_version"
    )
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300 hover:text-emerald-200"
            >
              ← Admin
            </Link>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Devices
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Manage Sentinel ESP32-S3 and Pi 5 installations.
            </p>
          </div>

          <Link
            href="/admin/devices/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#03110d] transition hover:bg-emerald-300"
          >
            <Plus size={17} />
            Add device
          </Link>
        </header>

        {error ? (
          <GlassCard className="mt-8 border-red-400/20 p-6">
            <p className="font-semibold text-red-300">
              Unable to load devices.
            </p>
            <p className="mt-2 text-sm text-white/60">{error.message}</p>
          </GlassCard>
        ) : devices?.length ? (
          <div className="mt-8 grid gap-4">
            {devices.map((device) => (
              <Link
                key={device.id}
                href={`/admin/devices/${device.id}`}
                className="block"
              >
                <GlassCard className="p-5 hover:border-emerald-400/30">
                  <div className="flex flex-wrap items-center justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <Cpu className="text-emerald-300" size={22} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-white">
                          {device.name}
                        </h2>
                        <p className="mt-1 text-sm text-white/50">
                          {device.device_id}
                          {device.site_name ? ` · ${device.site_name}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70">
                        {device.device_type === "esp32_s3" ? "ESP32-S3" : "Pi 5"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70">
                        {device.connection_type.toUpperCase()}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/70">
                        <Wifi size={14} />
                        {device.status.replace("_", " ")}
                      </span>
                      <ArrowRight className="text-white/40" size={18} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-xs text-white/50 sm:grid-cols-2 lg:grid-cols-3">
                    <p>
                      Firmware:{" "}
                      <span className="text-white/70">
                        {device.firmware_version || "—"}
                      </span>
                    </p>
                    <p>
                      Last seen:{" "}
                      <span className="text-white/70">
                        {device.last_seen
                          ? new Date(device.last_seen).toLocaleString()
                          : "Never"}
                      </span>
                    </p>
                    <p>
                      Connection:{" "}
                      <span className="text-white/70">
                        {device.connection_type}
                      </span>
                    </p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        ) : (
          <GlassCard className="mt-8 p-10 text-center">
            <Cpu className="mx-auto text-emerald-300" size={30} />
            <h2 className="mt-4 text-xl font-bold text-white">
              No devices registered
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">
              Register an ESP32-S3 or Pi 5 installation here. The device can
              remain disconnected until the communication layer is ready.
            </p>
            <Link
              href="/admin/devices/new"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#03110d]"
            >
              <Plus size={17} />
              Register first device
            </Link>
          </GlassCard>
        )}
      </div>
    </main>
  );
}

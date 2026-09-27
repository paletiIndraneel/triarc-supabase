"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30";

export default function NewDevicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [provisioned, setProvisioned] = useState<{ deviceId: string; secret: string; endpoint: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const deviceId = String(form.get("device_id") || "").trim();
    const payload = {
      name: String(form.get("name") || "").trim(),
      device_id: deviceId,
      site_name: String(form.get("site_name") || "").trim(),
      device_type: String(form.get("device_type") || "esp32_s3"),
    };

    if (!payload.name || !payload.device_id || !payload.site_name) {
      setError("Device name, device ID, and site are required.");
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { data, error: provisionError } = await supabase.functions.invoke("provision-sentinel", {
      body: payload,
    });

    if (provisionError || !data?.ok) {
      setError(provisionError?.message || data?.error || "Device provisioning failed.");
      setSaving(false);
      return;
    }

    setProvisioned({
      deviceId: data.device.device_id,
      secret: data.provisioning.secret,
      endpoint: data.provisioning.endpoint,
    });
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/devices" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          <ArrowLeft size={16} />
          Back to devices
        </Link>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Device management
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Register device
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Register and provision the physical device. The device communicates directly with Supabase over HTTPS; the device credential is generated once and shown only after provisioning.
          </p>
        </div>

        <GlassCard className="mt-8 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Device name" name="name" required placeholder="Sentinel Hyderabad 01" />
              <Field label="Device ID" name="device_id" required placeholder="SENTINEL-HYD-001" />
              <Field label="Site" name="site_name" required placeholder="Hyderabad EV Hub" />

              <label className="block">
                <span className="text-sm font-semibold text-white/80">
                  Device type <span className="text-emerald-300">*</span>
                </span>
                <select name="device_type" defaultValue="esp32_s3" className={inputClass}>
                  <option value="esp32_s3">ESP32-S3</option>
                  <option value="pi5">Pi 5</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
              <p className="text-sm font-semibold text-white">HTTPS telemetry</p>
              <p className="mt-1 text-sm leading-6 text-white/50">
                New devices use direct HTTPS to Supabase on port 443. No MQTT credentials or plaintext device secrets are stored in the database.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Initial status</p>
              <p className="mt-1 text-sm text-white/50">
                New devices start as <strong className="text-white/70">Not connected</strong> and will become online after the Sentinel successfully synchronizes with Supabase.
              </p>
            </div>

            {provisioned ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5">
                <p className="text-sm font-semibold text-amber-200">Provisioning credential — save this now</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  This secret is shown once. Store it in the Sentinel private configuration. It is not stored in plaintext in Supabase.
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <div><span className="text-white/40">Device ID:</span> <code className="text-white">{provisioned.deviceId}</code></div>
                  <div><span className="text-white/40">Endpoint:</span> <code className="break-all text-white">{provisioned.endpoint}</code></div>
                  <div><span className="text-white/40">Secret:</span> <code className="block break-all rounded-xl bg-black/30 p-3 text-white">{provisioned.secret}</code></div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={() => router.push("/admin/devices")} className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#03110d]">
                    Done
                  </button>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Link href="/admin/devices" className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5">
                Cancel
              </Link>
              <button type="submit" disabled={saving || Boolean(provisioned)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#03110d] disabled:opacity-50">
                <Save size={17} />
                {saving ? "Saving..." : "Register device"}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-white/80">
        {label}
        {required ? <span className="ml-1 text-emerald-300">*</span> : null}
      </span>
      <input name={name} required={required} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

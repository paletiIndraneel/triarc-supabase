"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DeviceManagement({
  device,
}: {
  device: {
    id: string;
    name: string;
    device_id: string;
    site_name: string | null;
    device_type: string;
    connection_type: string;
    endpoint: string | null;
    port: number | null;
    topic: string | null;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const connectionType = String(form.get("connection_type") || "mqtt");
    const deviceId = device.device_id.trim();
    const topicValue = String(form.get("topic") || "").trim();

    const payload = {
      name: String(form.get("name") || "").trim(),
      site_name: String(form.get("site_name") || "").trim() || null,
      device_type: String(form.get("device_type") || "esp32_s3"),
      connection_type: connectionType,
      endpoint: String(form.get("endpoint") || "").trim() || null,
      port: Number(form.get("port") || 8883),
      topic: topicValue || (connectionType === "mqtt" ? `triarc/devices/${deviceId}` : null),
    };

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("devices")
      .update(payload)
      .eq("id", device.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete device "${device.name}"? This also deletes its telemetry history.`)) return;

    setDeleting(true);
    setError("");

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("devices")
      .delete()
      .eq("id", device.id);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }

    router.push("/admin/devices");
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/5"
          >
            Edit device
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/5 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="w-full max-w-xl space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="name" defaultValue={device.name} required className={inputClass} placeholder="Device name" />
        <input name="site_name" defaultValue={device.site_name || ""} className={inputClass} placeholder="Site" />

        <select name="device_type" defaultValue={device.device_type} className={inputClass}>
          <option value="esp32_s3">ESP32-S3</option>
          <option value="pi5">Pi 5</option>
        </select>

        <select name="connection_type" defaultValue={device.connection_type || "mqtt"} className={inputClass}>
          <option value="mqtt">MQTT</option>
          <option value="websocket">WebSocket</option>
          <option value="http">HTTP</option>
        </select>

        <input
          name="endpoint"
          defaultValue={device.endpoint || ""}
          className={inputClass}
          placeholder="Broker hostname / endpoint"
        />

        <input
          name="port"
          type="number"
          min={1}
          max={65535}
          defaultValue={device.port || 8883}
          className={inputClass}
          placeholder="Port"
        />
      </div>

      <input
        name="topic"
        defaultValue={device.topic || `triarc/devices/${device.device_id}`}
        className={inputClass}
        placeholder="MQTT topic prefix"
      />

      <p className="text-xs leading-5 text-white/40">
        For HiveMQ Cloud MQTT, use TLS port 8883. Do not enter the MQTT username or password here; credentials remain outside the database and browser UI.
      </p>

      <p className="text-xs text-white/40">
        Device ID cannot be changed here because telemetry is keyed to it.
      </p>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#03110d] disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/50";

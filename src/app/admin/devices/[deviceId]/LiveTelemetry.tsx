"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Reading = {
  recorded_at: string;
  voltage: number | null;
  current: number | null;
  power: number | null;
  energy: number | null;
};

export default function LiveTelemetry({
  deviceId,
  initialReading,
}: {
  deviceId: string;
  initialReading: Reading | null;
}) {
  const [reading, setReading] = useState(initialReading);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`device-live-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_readings",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => setReading(payload.new as Reading)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deviceId]);

  const cards = [
    ["Voltage", reading?.voltage, "V"],
    ["Current", reading?.current, "A"],
    ["Power", reading?.power, "W"],
    ["Energy", reading?.energy, "kWh"],
  ] as const;

  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, unit]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
            <p className="mt-2 text-xl font-bold text-white">
              {value === null || value === undefined ? "—" : `${value} ${unit}`}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-white/30">
        {reading?.recorded_at
          ? `Last reading: ${new Date(reading.recorded_at).toLocaleString()}`
          : "Waiting for the first reading…"}
      </p>
    </div>
  );
}

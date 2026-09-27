import type { ReactNode } from "react";

type Reading = {
  id: number;
  recorded_at: string;
  voltage: number | null;
  current: number | null;
  power: number | null;
  energy: number | null;
  frequency: number | null;
  power_factor: number | null;
  temperature: number | null;
  humidity: number | null;
  internet: boolean | null;
};

export default function ReadingsTable({ readings }: { readings: Reading[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
            <th className="px-3 py-3">Time</th>
            <th className="px-3 py-3">Voltage</th>
            <th className="px-3 py-3">Current</th>
            <th className="px-3 py-3">Power</th>
            <th className="px-3 py-3">Energy</th>
            <th className="px-3 py-3">Frequency</th>
            <th className="px-3 py-3">PF</th>
            <th className="px-3 py-3">Temp</th>
            <th className="px-3 py-3">Internet</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((reading) => (
            <tr key={reading.id} className="border-b border-white/5 text-white/70">
              <td className="px-3 py-3 whitespace-nowrap">{new Date(reading.recorded_at).toLocaleString()}</td>
              <td className="px-3 py-3">{format(reading.voltage, " V")}</td>
              <td className="px-3 py-3">{format(reading.current, " A")}</td>
              <td className="px-3 py-3">{format(reading.power, " W")}</td>
              <td className="px-3 py-3">{format(reading.energy, " kWh")}</td>
              <td className="px-3 py-3">{format(reading.frequency, " Hz")}</td>
              <td className="px-3 py-3">{format(reading.power_factor, "")}</td>
              <td className="px-3 py-3">{format(reading.temperature, " °C")}</td>
              <td className="px-3 py-3">{reading.internet == null ? "—" : reading.internet ? "Online" : "Offline"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function format(value: number | null, suffix: string): ReactNode {
  return value == null ? "—" : `${value}${suffix}`;
}

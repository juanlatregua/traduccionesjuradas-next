"use client";

// components/puerta/DeadlineCountdown.tsx — Cuenta atrás de la puerta
// (v2 · Fase 1 · Bloque 1.4). "Paga antes de las 18:00 y empezamos hoy."

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const CUTOFF_HOUR = 18; // 18:00, hora de Madrid

type MadridTime = { weekday: number; secondsOfDay: number };

function getMadridTime(): MadridTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = weekdayMap[get("weekday")] ?? 1;
  let hour = parseInt(get("hour"), 10) || 0;
  if (hour === 24) hour = 0;
  const secondsOfDay =
    hour * 3600 + (parseInt(get("minute"), 10) || 0) * 60 +
    (parseInt(get("second"), 10) || 0);

  return { weekday, secondsOfDay };
}

function formatRemaining(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

export default function DeadlineCountdown() {
  const [time, setTime] = useState<MadridTime | null>(null);

  useEffect(() => {
    setTime(getMadridTime());
    const id = setInterval(() => setTime(getMadridTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hasta montar en cliente no renderiza nada (evita desajuste SSR).
  if (!time) return null;

  const isWeekend = time.weekday === 0 || time.weekday === 6;
  const remaining = CUTOFF_HOUR * 3600 - time.secondsOfDay;
  const beforeCutoff = !isWeekend && remaining > 0;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
        beforeCutoff
          ? "border-vert/25 bg-vert/5 text-encre"
          : "border-bleu/15 bg-cream text-graphite"
      }`}
    >
      <Clock
        className={`h-4 w-4 shrink-0 ${beforeCutoff ? "text-vert" : "text-bleu"}`}
        aria-hidden="true"
      />
      {beforeCutoff ? (
        <p>
          Pídela antes de las <strong>18:00</strong> y la ponemos en marcha hoy
          mismo — quedan{" "}
          <strong className="tabular-nums text-vert">
            {formatRemaining(remaining)}
          </strong>
          .
        </p>
      ) : (
        <p>
          La pondremos en marcha el próximo día laborable. El diagnóstico te
          confirma la fecha de entrega exacta.
        </p>
      )}
    </div>
  );
}

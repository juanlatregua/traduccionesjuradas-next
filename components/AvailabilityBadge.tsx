"use client";

import { useEffect, useState } from "react";

const CLOSING_TIME = "19:00";
const OPENING_TIME = "09:00";

function getMadridDate() {
  const now = new Date();
  const madridString = now.toLocaleString("en-US", {
    timeZone: "Europe/Madrid",
  });
  return new Date(madridString);
}

export function AvailabilityBadge({ variant = "pill" }: { variant?: "pill" | "inline" }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [timeLabel, setTimeLabel] = useState<string>("");

  useEffect(() => {
    const evaluate = () => {
      const madridNow = getMadridDate();
      const hours = madridNow.getHours();
      const minutes = madridNow.getMinutes();
      const withinSchedule = hours >= 9 && hours < 19; // 09:00 inclusive, 19:00 exclusive
      setIsOpen(withinSchedule);
      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      setTimeLabel(`${hh}:${mm} CET`);
    };

    evaluate();
    const id = setInterval(evaluate, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, []);

  const baseClasses =
    variant === "pill"
      ? "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
      : "inline-flex items-center gap-2 text-xs font-semibold";

  const colorClasses = isOpen
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <span className={`${baseClasses} ${variant === "pill" ? colorClasses : "text-slate-600"}`}>
      <span role="img" aria-label={isOpen ? "Disponible" : "Fuera de horario"}>
        {isOpen ? "🟢" : "⏳"}
      </span>
      {isOpen ? (
        <>
          Respondemos ahora · hasta las {CLOSING_TIME}
        </>
      ) : (
        <>
          Fuera de horario (ahora {timeLabel}). Respondemos a partir de {OPENING_TIME}.
        </>
      )}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "zona_traductor_theme";

type ThemeMode = "dark" | "light";

function applyTheme(mode: ThemeMode) {
  const root = document.getElementById("zona-traductor-root");
  if (!root) return;
  root.classList.toggle("zona-theme-light", mode === "light");
}

export default function ZonaTraductorThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode = stored === "light" ? "light" : "dark";
    setMode(initial);
    applyTheme(initial);
    setReady(true);
    return () => {
      const root = document.getElementById("zona-traductor-root");
      root?.classList.remove("zona-theme-light");
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  }, [mode, ready]);

  if (!ready) return null;

  return (
    <div className="mt-3 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/70 p-1 text-xs">
      <button
        type="button"
        onClick={() => setMode("dark")}
        className={`rounded-lg px-2.5 py-1 font-semibold transition ${
          mode === "dark" ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
        }`}
      >
        Oscuro
      </button>
      <button
        type="button"
        onClick={() => setMode("light")}
        className={`rounded-lg px-2.5 py-1 font-semibold transition ${
          mode === "light" ? "bg-white text-slate-900" : "text-slate-300 hover:bg-slate-800"
        }`}
      >
        Claro
      </button>
    </div>
  );
}


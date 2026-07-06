"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Sección colapsable con estado persistido (localStorage) y apertura por ancla:
// al navegar a #id (chips del menú), se abre y hace scroll aunque estuviera cerrada.
export default function CollapsibleSection({
  id,
  title,
  subtitle,
  right,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`contab-sec:${id}`);
      if (saved === "1") setOpen(true);
      else if (saved === "0") setOpen(false);
    } catch {}
  }, [id]);

  useEffect(() => {
    try {
      localStorage.setItem(`contab-sec:${id}`, open ? "1" : "0");
    } catch {}
  }, [id, open]);

  useEffect(() => {
    function openIfTargeted() {
      if (typeof window !== "undefined" && window.location.hash === `#${id}`) {
        setOpen(true);
        requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    }
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, [id]);

  return (
    <section id={id} ref={ref} className="mt-4 scroll-mt-28">
      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
            ▶
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">{title}</span>
            {subtitle && <span className="mt-0.5 block text-xs text-slate-400">{subtitle}</span>}
          </span>
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

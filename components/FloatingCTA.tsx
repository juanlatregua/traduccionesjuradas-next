"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function FloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      // show after 160px scroll to avoid covering hero CTA
      setVisible(scrolled > 160);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center sm:hidden">
      <div className="flex w-[92%] items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl shadow-emerald-500/30">
        <div className="text-xs leading-tight">
          <p className="text-[11px] uppercase tracking-wide text-emerald-200">¿Documento listo?</p>
          <p className="text-sm font-semibold">Pide precio ahora</p>
        </div>
        <Link
          href="/presupuesto"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/40"
        >
          Subir documento
        </Link>
      </div>
    </div>
  );
}

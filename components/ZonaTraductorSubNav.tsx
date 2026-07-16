"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubTab = { href: string; label: string; badge?: number };

// Sub-navegación de una etapa (Presupuestos, Contabilidad). Las pestañas que se
// retiraron de la barra principal viven aquí: siguen siendo las MISMAS páginas,
// solo dejan de competir por sitio en el menú de primer nivel.
export default function ZonaTraductorSubNav({ tabs }: { tabs: SubTab[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-slate-800 pb-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className="ml-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

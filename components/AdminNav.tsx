"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const LINKS = [
  { href: "/admin/quotes", label: "Presupuestos" },
  { href: "/admin/orders", label: "Pedidos" },
  { href: "/admin/metricas", label: "Métricas v2" },
  { href: "/admin/funnel", label: "Funnel" },
  { href: "/admin/collaborators", label: "Colaboradores" },
  { href: "/admin/chat", label: "Chat AI" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex items-center gap-3">
      <Link
        href="/zona-traductor"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zona traductor
      </Link>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/quotes", label: "Presupuestos" },
  { href: "/admin/orders", label: "Pedidos" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
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
    </nav>
  );
}

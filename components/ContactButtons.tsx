/// components/ContactButtons.tsx
"use client";

import IconEmail from "./IconEmail";
import IconWhatsapp from "./IconWhatsapp";
import Link from "next/link";
import { WHATSAPP_LINK } from "@/lib/contact";

export default function ContactButtons() {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <Link
        href="/presupuesto-instantaneo"
        className="inline-flex items-center gap-2 rounded-2xl bg-encre px-4 py-2 font-semibold text-white hover:bg-encre focus:outline-none focus:ring-2 focus:ring-bleu"
        aria-label="Obtener presupuesto instantáneo"
      >
        <IconEmail className="h-4 w-4 text-white" />
        <span>Presupuesto</span>
      </Link>

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-2xl bg-bleu px-4 py-2 font-semibold text-white hover:bg-bleu focus:outline-none focus:ring-2 focus:ring-bleu"
        aria-label="Contactar por WhatsApp"
      >
        <IconWhatsapp className="h-4 w-4 text-white" />
        <span>WhatsApp</span>
      </a>
    </div>
  );
}

/// components/ContactButtons.tsx
"use client";

import IconEmail from "./IconEmail";
import IconWhatsapp from "./IconWhatsapp";
import Link from "next/link";

// ⚠️ usa AQUÍ el mismo link que ya tienes en la home
const PRESUPUESTO_LINK = "/presupuesto";

const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hola, me gustaría solicitar un presupuesto para una traducción jurada. Gracias."
);

const WHATSAPP_URL = `https://wa.me/34951333614?text=${WHATSAPP_MESSAGE}`;

export default function ContactButtons() {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <Link
        href={PRESUPUESTO_LINK}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        aria-label="Ir al formulario de presupuesto"
      >
        <IconEmail className="h-4 w-4 text-white" />
        <span>Presupuesto</span>
      </Link>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        aria-label="Contactar por WhatsApp"
      >
        <IconWhatsapp className="h-4 w-4 text-white" />
        <span>WhatsApp</span>
      </a>
    </div>
  );
}

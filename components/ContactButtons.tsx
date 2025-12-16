// components/ContactButtons.tsx
"use client";

import IconEmail from "./IconEmail";
import IconWhatsapp from "./IconWhatsapp";

const EMAIL = "hola@traduccionesjuradas.net";
const WHATSAPP_URL = "https://wa.me/34951333614";

export default function ContactButtons() {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <a
        href={`mailto:${EMAIL}`}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
      >
        <IconEmail className="h-4 w-4 text-white" />
        <span>Enviar email</span>
      </a>

      <a
        href={WHATSAPP_URL}
        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
      >
        <IconWhatsapp className="h-4 w-4 text-white" />
        <span>Escribir por WhatsApp</span>
      </a>
    </div>
  );
}

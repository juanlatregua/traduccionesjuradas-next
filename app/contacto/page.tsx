// app/contacto/page.tsx
import type { Metadata } from "next";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contacto | Traducciones Juradas en España",
  description:
    "Contacto para traducciones juradas: email, WhatsApp y teléfono. Envíanos tus documentos para obtener un presupuesto rápido. Atención en toda España.",
};

export default function ContactoPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Contacto
      </h1>

      <p className="mt-4 text-sm text-slate-700">
        Puedes contactar con nosotros por teléfono, email o WhatsApp.
        Estaremos encantados de ayudarte con tu traducción jurada.
      </p>

      {/* BLOQUE PRINCIPAL DE CONTACTO */}
      <section className="mt-6 space-y-3 text-sm text-slate-700">
        {/* Teléfono */}
        <a
          href="tel:+34951333614"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
            Tel
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teléfono
            </span>
            <span className="text-sm text-slate-800">951 333 614</span>
          </div>
        </a>

        {/* Email */}
        <a
          href={MAIL_LINK}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
            @
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Correo electrónico
            </span>
            <span className="text-sm text-slate-800">
              hola@traduccionesjuradas.net
            </span>
          </div>
        </a>

        {/* WhatsApp */}
        <a
          href={WHATSAPP_LINK}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-emerald-300 hover:bg-emerald-50/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
            WA
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              WhatsApp
            </span>
            <span className="text-sm text-slate-800">+34 951 333 614</span>
          </div>
        </a>

        {/* Dirección */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[13px]">
            📍
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dirección
            </span>
            <span className="text-sm text-slate-800">
              Calle Esperanto, 9, 29007 Málaga
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

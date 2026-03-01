"use client";
// app/contacto/page.tsx
import { useState } from "react";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_DISPLAY, WHATSAPP_LINK, WHATSAPP_LOCAL } from "@/lib/contact";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";

export default function ContactoPage() {
  const [copied, setCopied] = useState<"email" | "whatsapp" | null>(null);

  const copy = async (text: string, type: "email" | "whatsapp") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      setCopied(null);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Contacto
      </h1>

      <p className="mt-4 text-sm text-sepia">
        Puedes contactar con nosotros por teléfono, email o WhatsApp.
        Estaremos encantados de ayudarte con tu traducción jurada.
      </p>
      <div className="mt-2">
        <AvailabilityBadge />
      </div>

      {/* BLOQUE PRINCIPAL DE CONTACTO */}
      <section className="mt-6 space-y-3 text-sm text-sepia">
        {/* Teléfono */}
        <a
          href="tel:+34951333614"
          className="flex items-center gap-3 rounded-xl border border-cream bg-card px-3 py-2 hover:border-bleu hover:bg-cream/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-[11px] font-semibold text-bleu">
            Tel
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
              Teléfono
            </span>
            <span className="text-sm text-encre">951 333 614</span>
          </div>
        </a>

        {/* Email */}
        <a
          href={MAIL_LINK}
          className="flex items-center gap-3 rounded-xl border border-cream bg-card px-3 py-2 hover:border-bleu hover:bg-cream/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-[11px] font-semibold text-bleu">
            @
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
              Correo electrónico
            </span>
            <span className="text-sm text-encre">
              hola@traduccionesjuradas.net
            </span>
          </div>
          <button
            type="button"
            onClick={() => copy("hola@traduccionesjuradas.net", "email")}
            className="ml-auto rounded-lg border border-cream px-2 py-1 text-[11px] font-semibold text-sepia hover:bg-cream"
          >
            {copied === "email" ? "Copiado" : "Copiar"}
          </button>
        </a>

        {/* WhatsApp */}
        <a
          href={WHATSAPP_LINK}
          className="flex items-center gap-3 rounded-xl border border-cream bg-card px-3 py-2 hover:border-bleu hover:bg-cream/50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-[11px] font-semibold text-bleu">
            WA
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
              WhatsApp
            </span>
            <span className="text-sm text-encre">{WHATSAPP_DISPLAY}</span>
          </div>
          <button
            type="button"
            onClick={() => copy(WHATSAPP_LOCAL, "whatsapp")}
            className="ml-auto rounded-lg border border-cream px-2 py-1 text-[11px] font-semibold text-sepia hover:bg-cream"
          >
            {copied === "whatsapp" ? "Copiado" : "Copiar"}
          </button>
        </a>

        {/* Dirección */}
        <div className="flex items-center gap-3 rounded-xl border border-cream bg-card px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-[13px]">
            📍
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-graphite">
              Dirección
            </span>
            <span className="text-sm text-encre">
              Calle Esperanto, 9, 29007 Málaga
            </span>
          </div>
        </div>
      </section>

      {/* FAQ breve */}
      <section className="mt-8 space-y-3 rounded-2xl border border-cream bg-card p-4 text-sm text-sepia shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-graphite">
          Preguntas rápidas
        </p>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Vale el PDF o necesito papel?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            El PDF firmado digitalmente es válido en la mayoría de trámites. Si te piden papel, lo enviamos por mensajería.
          </p>
        </details>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Cómo se paga?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            Transferencia, tarjeta, Bizum o PayPal. Para urgentes solemos pedir el pago antes de empezar.
          </p>
        </details>
        <details className="rounded-xl border border-cream bg-parchment px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-encre">
            ¿Qué pasa con mis documentos?
          </summary>
          <p className="mt-2 text-sm text-sepia">
            Solo se usan para tu presupuesto/traducción, viajan por HTTPS y se eliminan tras 30 días (o antes si lo pides).
          </p>
        </details>
      </section>
    </main>
  );
}

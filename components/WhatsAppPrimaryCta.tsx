"use client";

// CTA con WhatsApp como acción PRIMARIA (verde) y el presupuesto web como
// secundaria. Para superficies de DESCUBRIMIENTO/conversación (blog, páginas de
// idioma, home) — NO para la puerta/checkout, donde el cobro debe seguir primero.
// Emite whatsapp_click con el origen para medir el canal real.

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { track } from "@vercel/analytics";
import { buildPresupuestoWhatsAppLink } from "@/lib/contact";

export default function WhatsAppPrimaryCta({
  source,
  lang = null,
  page = null,
  whatsappLabel = "Escríbenos por WhatsApp",
  quoteLabel = "Ver precio al instante",
}: {
  source: string;
  lang?: string | null;
  page?: string | null;
  whatsappLabel?: string;
  quoteLabel?: string;
}) {
  const waHref = buildPresupuestoWhatsAppLink({ lang, page });
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("whatsapp_click", { source, ...(lang ? { lang } : {}) })}
        className="inline-flex items-center gap-2 rounded-2xl bg-vert px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-vert/90"
      >
        <MessageCircle className="h-4 w-4" />
        {whatsappLabel}
      </a>
      <Link
        href="/presupuesto-instantaneo"
        className="inline-flex items-center rounded-2xl border border-bleu/30 px-5 py-2.5 text-xs font-semibold text-bleu transition-colors hover:bg-bleu/5"
      >
        {quoteLabel}
      </Link>
    </div>
  );
}

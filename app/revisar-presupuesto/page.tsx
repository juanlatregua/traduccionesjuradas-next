import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { routePuertaQuoteRequest } from "@/lib/puerta-request-quote";
import { NUDGE_COPY, verifyReviewToken } from "@/lib/lead-nudge";

export const metadata: Metadata = {
  title: "Revisar presupuesto — Traducciones Juradas",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// Enlace «revisar a mano» del email de recuperación (lead-nudge). Token firmado
// con el sessionToken; abrirlo dispara el MISMO enrutado que «Solicitar
// presupuesto» de la puerta, una sola vez (idempotente).
export default async function RevisarPresupuestoPage({ searchParams }: { searchParams: { t?: string } }) {
  const secret = process.env.NEXTAUTH_SECRET || "";
  const parsed = verifyReviewToken(secret, searchParams.t);
  const t = NUDGE_COPY[parsed?.locale ?? "es"];
  let ok = !!parsed;

  if (parsed) {
    try {
      const first = await checkRateLimit({
        key: `revisar-presupuesto:${parsed.sessionToken}`,
        limit: 1,
        windowMs: 14 * 24 * 60 * 60 * 1000,
      });
      if (first.ok) {
        // Si ya hay una solicitud de precio nacida de esta sesión (puerta), no se enruta otra.
        const existing = await prisma.lavoriPriceRequest.findFirst({
          where: { expedienteRef: `puerta:${parsed.sessionToken}` },
          select: { id: true },
        });
        if (!existing) {
          const r = await routePuertaQuoteRequest({ sessionToken: parsed.sessionToken, locale: parsed.locale });
          if (r.status >= 400) ok = false;
        }
      }
    } catch (err) {
      console.error("[revisar-presupuesto] error", err);
      ok = false;
    }
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-bleu/10 bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl text-encre">{ok ? t.pageTitle : "Traducciones Juradas"}</h1>
        <p className="mt-3 text-encre/80">{ok ? t.pageBody : t.pageInvalid}</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-bleu px-5 py-2.5 text-sm font-semibold text-white">
          traduccionesjuradas.net
        </Link>
      </div>
    </main>
  );
}

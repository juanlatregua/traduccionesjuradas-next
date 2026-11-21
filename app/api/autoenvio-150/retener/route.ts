import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyCierreToken } from "@/lib/cierre-token";
import { RETENER_PURPOSE, recordRetenido } from "@/lib/autoenvio-150-holds";

export const runtime = "nodejs";

/* «Retener» de un toque (informe de clientes a medias): el borrador no saldrá solo a las 2,5 h.
   Enlace firmado por presupuesto. GET solo enseña el botón (los escáneres de correo siguen
   enlaces); el POST escribe la retención (FunnelEvent autoenvio_150_retenido). */

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1.2rem;color:#1a2a26;line-height:1.5}h1{font-size:1.3rem}a{color:#1e7666}button{font-size:1rem;padding:.6rem 1.2rem;border-radius:.5rem;border:0;background:#1e7666;color:#fff}</style></head><body><h1>${title}</h1>${body}</body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function parse(url: URL) {
  const q = String(url.searchParams.get("q") || "").slice(0, 80);
  const t = String(url.searchParams.get("t") || "").slice(0, 120);
  return { q, ok: verifyCierreToken(q, t, RETENER_PURPOSE) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!parse(url).ok) return page("Enlace no válido o caducado", '<p>Abre <a href="/zona-traductor/presupuestos">los presupuestos</a>.</p>', 403);
  const action = `${url.pathname}${url.search}`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return page("Retener el borrador", `<p>No saldrá solo a las 2,5 h: lo envías tú.</p><form method="post" action="${action}"><button type="submit">Retener</button></form>`);
}

export async function POST(req: Request) {
  const rl = await checkRateLimit({ key: `autoenvio-retener:${getClientIp(req)}`, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return page("Demasiados intentos", "<p>Vuelve a intentarlo en unos minutos.</p>", 429);
  const p = parse(new URL(req.url));
  if (!p.ok) return page("Enlace no válido o caducado", "<p>No se ha guardado nada.</p>", 403);
  const quote = await prisma.quote.findUnique({ where: { id: p.q }, select: { id: true, quoteNumber: true, status: true, sentAt: true } });
  if (!quote) return page("Presupuesto no encontrado", "<p>No se ha guardado nada.</p>", 404);
  if (quote.sentAt || quote.status !== "DRAFT") return page("Ya enviado", `<p>${quote.quoteNumber} ya no es un borrador.</p>`, 409);
  await recordRetenido(quote.id, quote.quoteNumber);
  return page("✓ Retenido", `<p>${quote.quoteNumber} no saldrá solo. <a href="/zona-traductor/presupuestos/${quote.id}">Abrir el presupuesto</a>.</p>`);
}

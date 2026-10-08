import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyCierreToken } from "@/lib/cierre-token";
import { QUOTE_LOST_REASONS, QUOTE_LOST_REASON_LABELS, type QuoteLostReasonCode } from "@/lib/quote-lost-reasons";

export const runtime = "nodejs";

/* Motivo de pérdida «con un clic» desde el vigía (email 8:00 y /zona-traductor/vigia):
   presupuesto caducado que el cliente ABRIÓ y no pagó. Enlace firmado por presupuesto y
   motivo. GET solo enseña el botón de confirmar (los escáneres de correo siguen enlaces);
   el POST escribe lostReason, y solo si el presupuesto sigue sin motivo humano. */

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1.2rem;color:#1a2a26;line-height:1.5}h1{font-size:1.3rem}a{color:#1e7666}button{font-size:1rem;padding:.6rem 1.2rem;border-radius:.5rem;border:0;background:#1e7666;color:#fff}</style></head><body><h1>${title}</h1>${body}</body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function parse(url: URL) {
  const q = String(url.searchParams.get("q") || "").slice(0, 80);
  const r = String(url.searchParams.get("r") || "").toUpperCase() as QuoteLostReasonCode;
  const t = String(url.searchParams.get("t") || "").slice(0, 120);
  return { q, r, ok: (QUOTE_LOST_REASONS as readonly string[]).includes(r) && verifyCierreToken(q, t, `motivo-${r}`) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = parse(url);
  if (!p.ok) return page("Enlace no válido o caducado", '<p>Abre <a href="/zona-traductor/vigia">la gestión de hoy</a>.</p>', 403);
  const action = `${url.pathname}${url.search}`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return page(`Motivo: ${QUOTE_LOST_REASON_LABELS[p.r]}`, `<form method="post" action="${action}"><button type="submit">Confirmar</button></form>`);
}

export async function POST(req: Request) {
  const rl = await checkRateLimit({ key: `cierre-motivo:${getClientIp(req)}`, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return page("Demasiados intentos", "<p>Vuelve a intentarlo en unos minutos.</p>", 429);
  const p = parse(new URL(req.url));
  if (!p.ok) return page("Enlace no válido o caducado", "<p>No se ha guardado nada.</p>", 403);
  const quote = await prisma.quote.findUnique({ where: { id: p.q }, select: { id: true, status: true, paidAt: true, lostReason: true } });
  if (!quote || quote.status !== "EXPIRED" || quote.paidAt) return page("Sin cambios", "<p>El presupuesto ya no está caducado sin pago.</p>", 409);
  if (quote.lostReason) return page("Ya tenía motivo", `<p>Se queda como estaba: ${QUOTE_LOST_REASON_LABELS[quote.lostReason as QuoteLostReasonCode] || quote.lostReason}.</p>`);
  const now = new Date();
  await prisma.quote.update({ where: { id: quote.id }, data: { lostReason: p.r, lostReasonNote: null, lostFeedbackAt: now } });
  return page("✓ Motivo guardado", `<p>${QUOTE_LOST_REASON_LABELS[p.r]}.</p>`);
}

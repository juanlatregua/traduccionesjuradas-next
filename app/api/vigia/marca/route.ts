import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyVigiaMarkToken } from "@/lib/vigia-mark";
import { MARK_POSPONER, MARK_TRATADO, POSTPONE_DAYS } from "@/lib/vigia-persona";

export const runtime = "nodejs";

/* «Ya lo traté (WhatsApp)» (+3 días) y «Posponer 7 días» del vigía. Enlace firmado
   (lib/vigia-mark.ts). GET solo enseña el botón de confirmar (los escáneres de
   correo siguen enlaces y marcarían todo); el POST registra la marca:
   - siempre en FunnelEvent (sessionId «vigia:<clave de persona>», step vigia_tratado
     / vigia_posponer; único por par, se refresca createdAt) → vale para leads,
     solicitudes y presupuestos sin tocar el schema;
   - y, si el ítem tiene presupuesto, un MessageLog WHATSAPP/SENT «manual» en él. */

const STEP = { t: "vigia_tratado", p: "vigia_posponer" } as const;

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1.2rem;color:#1a2a26;line-height:1.5}h1{font-size:1.3rem}a{color:#1e7666}button{font-size:1rem;padding:.6rem 1.2rem;border-radius:.5rem;border:0;background:#1e7666;color:#fff}.m{color:#6b7a75;font-size:.9rem}</style></head><body><h1>${title}</h1>${body}</body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function parse(url: URL) {
  const k = String(url.searchParams.get("k") || "").slice(0, 200);
  const q = String(url.searchParams.get("q") || "").slice(0, 80);
  const a = String(url.searchParams.get("a") || "");
  const t = String(url.searchParams.get("t") || "").slice(0, 120);
  return { k, q, a, ok: (a === "t" || a === "p") && verifyVigiaMarkToken(k, q, a, t) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = parse(url);
  if (!p.ok) return page("Enlace no válido o caducado", '<p>Abre <a href="/zona-traductor/vigia">la gestión de hoy</a> y márcalo desde allí.</p>', 403);
  const what = p.a === "t" ? "Marcar como tratado (no vuelve a salir en 4 días)" : `Posponer ${POSTPONE_DAYS} días`;
  const action = `${url.pathname}${url.search}`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return page(what, `<form method="post" action="${action}"><button type="submit">Confirmar</button></form>`);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `vigia-marca:${ip}`, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return page("Demasiados intentos", "<p>Vuelve a intentarlo en unos minutos.</p>", 429);
  const p = parse(new URL(req.url));
  if (!p.ok) return page("Enlace no válido o caducado", "<p>No se ha guardado nada.</p>", 403);
  const step = STEP[p.a as "t" | "p"];
  const now = new Date();
  const sessionId = `vigia:${p.k}`;
  const reference = p.q || p.k.slice(0, 60);
  await prisma.funnelEvent.upsert({
    where: { sessionId_step: { sessionId, step } },
    create: { sessionId, step, reference, metadata: { quoteId: p.q || null } },
    update: { createdAt: now, reference, metadata: { quoteId: p.q || null } },
  });
  if (p.q) {
    const quote = await prisma.quote.findUnique({ where: { id: p.q }, select: { id: true } });
    if (quote) {
      await prisma.messageLog.create({
        data: { quoteId: quote.id, channel: "WHATSAPP", type: "DRAFT_WHATSAPP", recipient: "manual", body: p.a === "t" ? MARK_TRATADO : MARK_POSPONER, status: "SENT", sentAt: now },
      });
    }
  }
  return page(p.a === "t" ? "Hecho: tratado" : `Hecho: pospuesto ${POSTPONE_DAYS} días`, '<p>Ya no saldrá en la gestión de hoy. <a href="/zona-traductor/vigia">Ver lo que queda</a>.</p>');
}

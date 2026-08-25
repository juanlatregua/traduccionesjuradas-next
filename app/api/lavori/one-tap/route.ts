import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyLavoriOneTapToken } from "@/lib/lavori-onetap";
import { leadFromPuertaSession, sendLeadPriceRequest } from "@/lib/lavori-lead";

export const runtime = "nodejs";

/* Enlace "de un toque" del aviso a staff (email + SMS) cuando un lead de la puerta
   pide presupuesto humano y su par tiene carril en lavori: Juan pulsa desde el
   móvil y la solicitud de precio sale al candidato del par con los documentos ya
   analizados (por url + sha256), sin abrir el builder. Firmado (HMAC + caducidad),
   idempotente (ref por contenido: dos toques = una solicitud) y sin PII en el sobre.
   Devuelve una página mínima con el resultado y el enlace al builder (?lead=). */

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1.2rem;color:#1a2a26;line-height:1.5}h1{font-size:1.3rem}a{color:#1e7666}p{margin:.6rem 0}.m{color:#6b7a75;font-size:.9rem}</style></head><body><h1>${title}</h1>${body}</body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `lavori-one-tap:${ip}`, limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return page("Demasiados intentos", "<p>Vuelve a intentarlo en unos minutos.</p>", 429);

  const url = new URL(req.url);
  const sessionToken = String(url.searchParams.get("s") || "").trim().slice(0, 80);
  const token = String(url.searchParams.get("t") || "").trim().slice(0, 120);
  if (!sessionToken || !verifyLavoriOneTapToken(sessionToken, token)) {
    return page("Enlace no válido o caducado", "<p>Abre el builder y lanza la solicitud desde allí.</p>", 403);
  }

  const lead = await leadFromPuertaSession(sessionToken);
  if (!lead || !lead.sourceLang) {
    return page("Sin documentos analizables", "<p>Este lead no tiene documentos con idioma detectado. Ábrelo en el builder y ponlo a mano.</p>", 404);
  }

  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const hint = [lead.contact.name, lead.contact.email, lead.contact.phone].filter(Boolean).join(" · ") || null;
  const result = await sendLeadPriceRequest({
    docs: lead.docs,
    sourceLang: lead.sourceLang,
    targetLang: lead.targetLang,
    words: lead.words,
    expedienteRef: `puerta:${sessionToken}`,
    customerHint: hint,
    createdBy: "one-tap",
  });
  if (!result.ok) {
    const builder = `${baseUrl}/zona-traductor/presupuesto?session=${encodeURIComponent(sessionToken)}`;
    return page("No se pudo enviar", `<p>${result.error}</p><p><a href="${builder}">Abrir el lead en el builder</a> y pedirlo a mano.</p>`, result.status);
  }

  const builder = `${baseUrl}/zona-traductor/presupuesto?lead=${encodeURIComponent(result.ref)}`;
  const quien = result.nombres.join(", ");
  const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  return page(
    result.repetido ? `Ya estaba enviada a ${quien}` : `✓ Enviada a ${quien} · ${hora}`,
    `<p>Solicitud de precio ${result.par} (${lead.docs.length} documento${lead.docs.length === 1 ? "" : "s"}${lead.words ? `, ~${lead.words} palabras` : ""}) en el tablón de lavori. Cuando el traductor pase su precio te llegará por email.</p><p><a href="${builder}">Abrir en el builder</a> (ref ${result.ref})</p><p class="m">Repetir este enlace no duplica la solicitud.</p>`
  );
}

// Lo que staff recibe de una entrada confirmada: enlaces que funcionan hoy (ficha del caso y constructor de
// presupuestos con los documentos dentro), el resumen de lo que contó el cliente y el par con el que sigue.
import { fmtNeededBy } from "../needed-by.ts";
import { isRegularizacion } from "./fr-auto.ts";
import { sessionKeyOf, type EntradaRow } from "./store.ts";
import { langName } from "./view.ts";

const SITE = "https://www.traduccionesjuradas.net";

/** PRESUPUESTO_TO, si falta ADMIN_EMAIL, y si no el buzón: nunca un aviso que se salta en silencio. */
export const staffTo = (env: Record<string, string | undefined>) => env.PRESUPUESTO_TO || env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";

export function staffLinks(e: Pick<EntradaRow, "id" | "casoId" | "email" | "nombre" | "phone9">) {
  const q = new URLSearchParams({ session: sessionKeyOf(e.id) });
  if (e.email) q.set("customerEmail", e.email);
  if (e.nombre) q.set("customerName", e.nombre);
  if (e.phone9) q.set("customerPhone", e.phone9);
  return {
    caso: e.casoId ? `${SITE}/zona-traductor/casos/${encodeURIComponent(e.casoId)}` : null,
    builder: `${SITE}/zona-traductor/presupuesto?${q.toString()}`,
  };
}

export const plazoTexto = (e: Pick<EntradaRow, "urgency" | "neededBy">) =>
  e.urgency === "DATE" && e.neededBy ? `para el ${fmtNeededBy(e.neededBy)}` : e.urgency === "ASAP" ? "lo antes posible" : e.urgency === "FLEXIBLE" ? "sin prisa" : "sin indicar";

export function idiomasTexto(e: Pick<EntradaRow, "sourceLang" | "targetLang" | "targetLangs">) {
  const targets = e.targetLangs.length ? e.targetLangs : e.targetLang ? [e.targetLang] : [];
  return `${e.sourceLang ? langName(e.sourceLang) : "?"} → ${targets.map(langName).join(", ") || "?"}`;
}

/** Text lines (puerta-request-quote emails) with what the client said in the entrada. */
export function entradaResumen(e: EntradaRow, x: { casoRef: string | null; documentos: number; excluidos: string[] }): string[] {
  const l = staffLinks(e);
  const targets = e.targetLangs.length ? e.targetLangs : e.targetLang ? [e.targetLang] : [];
  return [
    `Entrada web confirmada${x.casoRef ? ` (${x.casoRef})` : ""}: ${x.documentos} documento(s) · ${idiomasTexto(e)} · plazo: ${plazoTexto(e)}${e.organismo ? ` · organismo: ${e.organismo}` : ""}${e.pais ? ` (${e.pais})` : ""}`,
    ...(e.respuestas ?? []).map((r) => `· ${r.pregunta}: ${r.respuesta}`),
    ...(e.notas ? [`El cliente añade: «${e.notas}»`] : []),
    ...(x.excluidos.length ? [`⚠ ${x.excluidos.length} documento(s) fuera del presupuesto (${x.excluidos.join("; ").slice(0, 300)}): sus archivos siguen en la lista de abajo, no los presupuestes.`] : []),
    ...(targets.length > 1 ? [`⚠ Pide ${targets.length} idiomas de destino: este aviso sigue solo ${langName(targets[0])}; los demás, a mano.`] : []),
    ...(isRegularizacion(e) ? ["Campaña: regularización 2026 (25 € por documento francés de hasta 2 páginas)."] : []),
    ...(e.lang && e.lang !== "es" ? [`Idioma del cliente: ${e.lang}`] : []),
    ...(l.caso ? [`Ficha del caso (archivos y respuestas): ${l.caso}`] : []),
  ];
}

/** The pair the old router follows: the entrada's own languages, else the only source language the reading found. */
export function routingPair(e: Pick<EntradaRow, "sourceLang" | "targetLang" | "targetLangs">, read: { documents: { included: boolean; sourceLang: string }[]; targetLang: string | null } | null) {
  const known = (l: string | null | undefined) => {
    const v = String(l || "").trim().toLowerCase();
    return v && v !== "unknown" && /^[a-z]{2,3}$/.test(v) ? v : null;
  };
  const sources = new Set((read?.documents ?? []).filter((d) => d.included).map((d) => known(d.sourceLang)).filter((x): x is string => !!x));
  const source = known(e.sourceLang) ?? (sources.size === 1 ? [...sources][0] : null);
  const target = known(e.targetLangs[0]) ?? known(e.targetLang) ?? known(read?.targetLang);
  return source && target && source !== target ? { sourceLang: source, targetLang: target } : null;
}

type Lectura = {
  documents: { included: boolean; excludedReason: string | null; editedBy: string | null; parts: { fileIndex: number }[]; annexes: { parts: { fileIndex: number }[] }[] }[];
  files: { position: number | null; name: string }[];
};

export const byClient = (d: { editedBy: string | null }) => Boolean(d.editedBy?.startsWith("cliente:"));

/** Why this entrada must NOT go to lavori by itself (a juror would price files or pairs the client does not want). */
export function staffOnlyReason(e: Pick<EntradaRow, "targetLang" | "targetLangs">, data: Lectura | null): string | null {
  const targets = e.targetLangs.length ? e.targetLangs : e.targetLang ? [e.targetLang] : [];
  if (targets.length > 1) return `pide ${targets.length} idiomas de destino`;
  if (!data) return null;
  if (data.documents.some((d) => !d.included && byClient(d))) return "el cliente ha quitado documentos";
  const used = new Set(data.documents.filter((d) => d.included).flatMap((d) => [...d.parts, ...d.annexes.flatMap((a) => a.parts)].map((p) => p.fileIndex)));
  const sobran = data.files.filter((f) => f.position === null || !used.has(f.position));
  return sobran.length ? `${sobran.length} archivo(s) sin documento que traducir (${sobran.map((f) => f.name).join(", ").slice(0, 120)})` : null;
}

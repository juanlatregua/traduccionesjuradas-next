import RecurrentClientBadge from "@/components/RecurrentClientBadge";
import OpenSiblingsBanner from "@/components/OpenSiblingsBanner";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { findLiveSiblingLeadRequest } from "@/lib/lavori-lead";
import { deadlineLine, deadlineOf, frDeliveryPrefill, isUrgentDeadline, type Deadline } from "@/lib/needed-by";
import StaffExpedienteIntake from "@/components/StaffExpedienteIntake";
import { presupuestoVivoDelCaso, solicitudesVivasDelHilo } from "@/lib/caso/hilo-db";
import { nombreMiembro } from "@/lib/caso/vista";
import { parFromLangs } from "@/lib/lavori-dup-guard";
import { priceBasisForMember } from "@/lib/lavori-directo";
import { channelPriceToBaseCents } from "@/lib/lavori-directo-math";

export const metadata: Metadata = {
  title: "Zona traductor — Presupuesto",
  description: "Crea un presupuesto manual o sube los documentos de un expediente.",
  robots: { index: false, follow: false },
};

const s = (raw?: string | string[]) =>
  (Array.isArray(raw) ? raw[0] : raw || "").trim();

function parseLangPair(raw: string) {
  const [source, target] = raw.toLowerCase().split("-");
  return source && target ? { source, target } : { source: "", target: "" };
}

export default async function ZonaTraductorPresupuestoPage({
  searchParams,
}: {
  searchParams: {
    exp?: string;
    lead?: string;
    session?: string;
    inbox?: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    sourceLang?: string;
    targetLang?: string;
    langPair?: string;
    lineDescription?: string;
    lineAmount?: string;
    deliveryType?: string;
  };
}) {
  await authZonaTraductorOrRedirect();

  // "puerta:<token>" no es un expediente: es la sesion de la puerta (lead automatico
  // a lavori). Si llega por ?exp= se trata como ?session= (27-ago: los docs del lead
  // no se veian porque el builder buscaba exp:puerta:<token>).
  const expRaw = typeof searchParams.exp === "string" ? searchParams.exp.trim() : "";
  const expRef = expRaw && !expRaw.startsWith("puerta:") ? expRaw : null;
  const expPuertaSession = expRaw.startsWith("puerta:") ? expRaw.slice("puerta:".length) : "";

  // Solicitud de precio de lavori (lead sin expediente, p. ej. WhatsApp): el builder
  // arranca con el par, el cliente, la linea y el COSTE que propuso el traductor
  // (margen en auto), y el presupuesto que nazca de aqui se ata a la solicitud
  // (lavoriLeadRef) para que el pago dispare precio_aceptado sin tocar la BD.
  // Email de la bandeja (/admin/inbox → "Montar presupuesto"): se muestra
  // entero encima de los documentos para fijar precio/plazo leyendo lo que pide.
  const inboxId = s(searchParams.inbox).trim().slice(0, 64) || null;
  const inboundEmail = inboxId
    ? await prisma.inboundEmail.findUnique({
        where: { id: inboxId },
        select: { id: true, channel: true, fromName: true, fromEmail: true, fromPhone: true, subject: true, bodyText: true, bodyPreview: true, receivedAt: true, casoId: true },
      })
    : null;
  const leadRef = s(searchParams.lead).trim().slice(0, 40) || null;
  // Abierto por sesión de la puerta (?session= o ?exp=puerta:…, enlaces del digest y
  // del aviso de lead): si esa sesión ya tiene solicitud en lavori, el presupuesto
  // nace atado igual que con ?lead= (8-sep-2026: 2026-00128 nació suelto y el pago
  // abrió un segundo encargo a Daniela).
  const sessionParam = s(searchParams.session).trim().slice(0, 80) || expPuertaSession.slice(0, 80);
  const lead = leadRef
    ? await prisma.lavoriPriceRequest.findUnique({ where: { ref: leadRef } })
    : sessionParam || expRef
      ? await prisma.lavoriPriceRequest.findFirst({ where: { expedienteRef: sessionParam ? `puerta:${sessionParam}` : expRef! }, orderBy: { createdAt: "desc" } })
      : null;
  // Lead de la PUERTA (25-ago-2026): ?session=<token> o una solicitud lavori nacida
  // de la puerta (expedienteRef "puerta:<token>") → los documentos ya subidos por
  // el cliente entran en el builder sin volver a soltar el PDF.
  const puertaSession =
    sessionParam || (lead?.expedienteRef?.startsWith("puerta:") ? lead.expedienteRef.slice("puerta:".length).slice(0, 80) : "");
  const sessionKey = expRef ? `exp:${expRef}` : puertaSession || null;

  // Hilo único (F3b): el caso de esta gestión ya tiene presupuesto vivo DEL PAR → se va a
  // ÉL. Cambiarlo es «Editar datos y líneas», nunca otro número. Par: el de la solicitud,
  // el del enlace o el único de los documentos de la sesión (varios pares → no se adivina).
  const casoId =
    lead?.casoId ||
    (sessionKey ? (await prisma.documentAnalysis.findFirst({ where: { sessionToken: sessionKey, casoId: { not: null } }, select: { casoId: true } }))?.casoId : null) ||
    (expRef ? (await prisma.quote.findFirst({ where: { expedienteRef: expRef, casoId: { not: null } }, select: { casoId: true } }))?.casoId : null) ||
    inboundEmail?.casoId ||
    null;
  const parEnlace = parseLangPair(s(searchParams.langPair));
  const parDeSesion = async () => {
    if (!sessionKey) return null;
    const filas = await prisma.documentAnalysis.findMany({ where: { sessionToken: sessionKey }, select: { sourceLanguage: true, targetLanguage: true } });
    const known = (l: string | null) => (l && l !== "unknown" ? l : null);
    const pares = new Set(filas.map((f) => parFromLangs(known(f.sourceLanguage), known(f.targetLanguage) || "es")).filter(Boolean));
    return pares.size === 1 ? [...pares][0] : null;
  };
  const parPagina =
    lead?.par ||
    parFromLangs(s(searchParams.sourceLang) || parEnlace.source, s(searchParams.targetLang) || parEnlace.target) ||
    (casoId ? await parDeSesion() : null);
  const vigente = await presupuestoVivoDelCaso(casoId, parPagina).catch(() => null);
  if (vigente) redirect(`/zona-traductor/presupuestos/${vigente.id}`);

  // La solicitud ya tiene presupuesto: se va a ESE presupuesto, no se monta otro
  // (Juan 9-sep: "los duplica").
  if (lead?.quoteId) {
    const existente = await prisma.quote.findFirst({ where: { id: lead.quoteId, deletedAt: null }, select: { id: true } });
    if (existente) redirect(`/zona-traductor/presupuestos/${existente.id}`);
  }
  const leadPair = lead ? lead.par.toLowerCase().split(">") : [];
  const leadHintParts = (lead?.customerHint || "").split(" · ").map((x) => x.trim()).filter(Boolean);
  const leadPhone = leadHintParts.find((x) => /\+?\d[\d\s]{6,}/.test(x));
  const leadName = leadHintParts.find((x) => x !== leadPhone && !x.includes("@"));
  const leadEmail = leadHintParts.find((x) => x.includes("@"));
  // Solicitud sin presupuesto pero con HERMANA viva del mismo cliente y par que sí lo
  // tiene (Cosmos, 14-sep-2026: la 2.ª subida abrió otra solicitud a Morton): se va al
  // presupuesto existente en vez de montar el duplicado.
  if (lead && !lead.quoteId) {
    const hermana = await findLiveSiblingLeadRequest({ email: leadEmail, phone: leadPhone, par: lead.par, days: 30, excludeRef: lead.ref }).catch(() => null);
    if (hermana?.quote) redirect(`/zona-traductor/presupuestos/${hermana.quote.id}`);
  }

  // Prefill del builder manual (deep-links desde el panel del pedido, PM, etc.).
  const pair = parEnlace;
  const builderInitial = {
    customerName: s(searchParams.customerName) || undefined,
    customerEmail: s(searchParams.customerEmail) || undefined,
    customerPhone: s(searchParams.customerPhone) || undefined,
    sourceLang: s(searchParams.sourceLang) || pair.source || undefined,
    targetLang: s(searchParams.targetLang) || pair.target || undefined,
    deliveryType:
      s(searchParams.deliveryType).toUpperCase() === "PAPER_SHIP"
        ? ("PAPER_SHIP" as const)
        : undefined,
    lineDescription: s(searchParams.lineDescription) || undefined,
    lineAmount: s(searchParams.lineAmount) || undefined,
  };
  if (lead) {
    builderInitial.customerName ||= leadName;
    builderInitial.customerEmail ||= leadEmail;
    builderInitial.customerPhone ||= leadPhone?.replace(/\s+/g, "");
    builderInitial.sourceLang ||= leadPair[0];
    builderInitial.targetLang ||= leadPair[1];
    builderInitial.lineDescription ||= `Traducción jurada ${lead.par} · ${lead.docsCount} documento${lead.docsCount === 1 ? "" : "s"}${lead.words ? ` (~${lead.words} palabras)` : ""}`;
  }
  // Solicitudes vivas del hilo (caso + esta gestión): con una del par, el constructor
  // no ofrece pedir otra; su cifra es el coste de las líneas.
  const vivas = await solicitudesVivasDelHilo(casoId, {
    lprRef: lead?.ref,
    expedienteRef: lead?.expedienteRef || (expRef ?? (puertaSession ? `puerta:${puertaSession}` : undefined)),
  }).catch(() => []);
  const solicitudesVivas = vivas.map((l) => ({
    ref: l.ref,
    par: l.par,
    status: l.status,
    priceCents: l.priceCents,
    plazoDias: l.plazoDias,
    miembroNombre: l.miembroNombre,
    nombres: l.candidatos.map((id) => nombreMiembro(id) || id),
    createdAt: l.createdAt.toISOString(),
  }));
  // Cifra del jurado como coste: de las vivas y de la solicitud abierta aunque ya no viva (más de 30 días, retirada).
  const conCifra = [...vivas, ...(lead && !vivas.some((l) => l.ref === lead.ref) && !["RETIRED", "RETIRING", "DISCARDED"].includes(String(lead.status)) ? [lead] : [])].filter((l) => l.priceCents);
  const costesJurado = conCifra.map((l) => ({
    ref: l.ref,
    par: l.par,
    baseCents: channelPriceToBaseCents(l.priceCents!, priceBasisForMember(l.miembroId)),
    docsCount: l.docsCount,
  }));
  let initialDocs: { documentId: string; fileName: string; fileUrl?: string }[] | undefined;
  let initialCustomer: { name?: string; email?: string; phone?: string } | undefined;
  let plazo: Deadline | null = null;
  let plazoPages = 0;
  let plazoFr = false;

  if (inboundEmail) {
    builderInitial.customerName ||= inboundEmail.fromName || undefined;
    builderInitial.customerEmail ||= inboundEmail.fromEmail;
    builderInitial.customerPhone ||= inboundEmail.fromPhone || undefined;
  }

  if (sessionKey) {
    const rows = await prisma.documentAnalysis.findMany({
      where: { sessionToken: sessionKey },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, fileUrl: true, clientName: true, clientEmail: true, clientPhone: true, urgency: true, neededBy: true, pageCount: true, sourceLanguage: true, targetLanguage: true },
    });
    plazo = deadlineOf(rows);
    plazoPages = rows.reduce((n, r) => n + (r.pageCount || 1), 0);
    plazoFr = rows.some((r) => r.sourceLanguage === "fr" || r.targetLanguage === "fr");
    if (rows.length > 0) {
      initialDocs = rows.map((r) => ({ documentId: r.id, fileName: r.fileName, fileUrl: r.fileUrl }));
      initialCustomer = {
        name: rows[0].clientName || undefined,
        email: rows[0].clientEmail || undefined,
        phone: rows[0].clientPhone || undefined,
      };
    }
  }

  if (!plazo && casoId) {
    const c = await prisma.caso.findUnique({ where: { id: casoId }, select: { urgency: true, neededBy: true } });
    if (c?.urgency || c?.neededBy) plazo = c;
  }
  plazoFr ||= (lead?.par || parPagina || "").toUpperCase().split(">").includes("FR");
  const plazoTxt = deadlineLine(plazo);
  // Francés (lo jura Juan): prefill del plazo según su regla; el +40 % NO se aplica solo.
  const plazoFrPrefill = plazoFr ? frDeliveryPrefill(plazo, plazoPages) : null;

  const recurrentEmail = builderInitial.customerEmail || initialCustomer?.email;
  const recurrentPhone = builderInitial.customerPhone || initialCustomer?.phone;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <a href="/zona-traductor/expedientes" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Expedientes
          </a>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            Presupuesto{expRef ? ` de expediente · ${expRef}` : lead ? ` de solicitud lavori · ${lead.ref}` : ""}
          </h1>
          <RecurrentClientBadge email={recurrentEmail} phone={recurrentPhone} />
          <OpenSiblingsBanner
            email={recurrentEmail}
            phone={recurrentPhone}
            par={builderInitial.sourceLang && builderInitial.targetLang ? `${builderInitial.sourceLang}>${builderInitial.targetLang}`.toUpperCase() : null}
            excludeSession={puertaSession || null}
            excludeLprRef={lead?.ref ?? null}
            excludeInboxId={inboxId}
            casoId={casoId}
          />
          {lead && (
            <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {lead.priceCents
                ? `${lead.miembroNombre || "El traductor"} propuso ${(lead.priceCents / 100).toFixed(2)} €${lead.plazoDias ? ` · ${lead.plazoDias} días` : ""} (${lead.par}). Entra como coste de las líneas que cubre; el precio de venta es el del motor y solo sube si el margen no llega.`
                : `Solicitud ${lead.par} enviada a lavori; el traductor aún no ha pasado precio.`}
              {" "}Al crear el presupuesto queda atado a esta solicitud: el pago avisará al traductor.
              {initialDocs?.length ? ` Los ${initialDocs.length} documento${initialDocs.length === 1 ? "" : "s"} de la puerta ya están abajo.` : lead.docsCount > 0 ? " Suelta aquí los documentos del cliente (no hay expediente)." : ""}
            </p>
          )}
          {plazoTxt && (
            <p className={`mt-2 rounded-lg border px-3 py-2 text-sm ${isUrgentDeadline(plazo) ? "border-rose-500/40 bg-rose-500/10 text-rose-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
              {plazoTxt.replace("Lo necesita:", "El cliente lo necesita:")}
              {plazoFrPrefill?.hint ? ` · ${plazoFrPrefill.hint}` : ""}
            </p>
          )}
          {inboundEmail && (
            <details
              open
              className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100"
            >
              <summary className="cursor-pointer font-semibold text-sky-200">
                {inboundEmail.channel === "WHATSAPP" ? "WhatsApp del cliente" : "Email del cliente"} · {inboundEmail.fromName || inboundEmail.fromPhone || inboundEmail.fromEmail} · {inboundEmail.subject}
                <span className="ml-2 font-normal text-sky-300/80">
                  {inboundEmail.receivedAt.toLocaleString("es-ES")}
                </span>
              </summary>
              <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sky-50/90">
                {inboundEmail.bodyText || inboundEmail.bodyPreview}
              </p>
              <p className="mt-2 text-xs text-sky-300/80">
                Al enviar el presupuesto, la respuesta desde la bandeja ya lo citará (número, total y enlace de pago).
              </p>
            </details>
          )}
          <p className="mt-1 text-sm text-slate-400">
            {expRef
              ? "Expediente del cliente. Los documentos se están analizando automáticamente. Revisa la tabla y genera el presupuesto."
              : "Crea un presupuesto manual (lead de WhatsApp/teléfono) o suelta los documentos del cliente abajo para extraer tipo, idioma, palabras y precio automáticamente."}
          </p>
        </header>

        <StaffExpedienteIntake
          initialDocs={initialDocs}
          initialCustomer={initialCustomer}
          initialData={expRef ? undefined : builderInitial}
          expedienteRef={expRef}
          lavoriLeadRef={lead?.ref ?? null}
          casoId={casoId}
          puertaSession={puertaSession || null}
          initialDeliveryNote={plazoFrPrefill?.term}
          solicitudesVivas={solicitudesVivas}
          costesJurado={lead?.priceCents ? [...costesJurado].sort((a, b) => Number(b.ref === lead.ref) - Number(a.ref === lead.ref)) : costesJurado}
          emailContext={
            inboundEmail
              ? { id: inboundEmail.id, fromName: inboundEmail.fromName, fromEmail: inboundEmail.fromEmail, subject: inboundEmail.subject, text: (inboundEmail.bodyText || inboundEmail.bodyPreview || "").split(/\n(?:>|El .{0,120}escribi[oó]:|On .{0,120}wrote:|Le .{0,120}a écrit)/)[0].slice(0, 600) }
              : null
          }
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import StaffExpedienteIntake from "@/components/StaffExpedienteIntake";

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

  const expRef = typeof searchParams.exp === "string" ? searchParams.exp : null;

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
        select: { id: true, channel: true, fromName: true, fromEmail: true, fromPhone: true, subject: true, bodyText: true, bodyPreview: true, receivedAt: true },
      })
    : null;
  const leadRef = s(searchParams.lead).trim().slice(0, 40) || null;
  const lead = leadRef ? await prisma.lavoriPriceRequest.findUnique({ where: { ref: leadRef } }) : null;
  const leadPair = lead ? lead.par.toLowerCase().split(">") : [];
  const leadHintParts = (lead?.customerHint || "").split(" · ").map((x) => x.trim()).filter(Boolean);
  const leadPhone = leadHintParts.find((x) => /\+?\d[\d\s]{6,}/.test(x));
  const leadName = leadHintParts.find((x) => x !== leadPhone && !x.includes("@"));
  const leadEmail = leadHintParts.find((x) => x.includes("@"));

  // Prefill del builder manual (deep-links desde el panel del pedido, PM, etc.).
  const pair = parseLangPair(s(searchParams.langPair));
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
  const builderInitialConLead = lead
    ? { ...builderInitial, lineCost: lead.priceCents ? (lead.priceCents / 100).toFixed(2) : undefined }
    : builderInitial;
  let initialDocs: { documentId: string; fileName: string; fileUrl?: string }[] | undefined;
  let initialCustomer: { name?: string; email?: string; phone?: string } | undefined;

  if (inboundEmail) {
    builderInitial.customerName ||= inboundEmail.fromName || undefined;
    builderInitial.customerEmail ||= inboundEmail.fromEmail;
    builderInitial.customerPhone ||= inboundEmail.fromPhone || undefined;
  }

  if (expRef) {
    const rows = await prisma.documentAnalysis.findMany({
      where: { sessionToken: `exp:${expRef}` },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, fileUrl: true, clientName: true, clientEmail: true, clientPhone: true },
    });
    if (rows.length > 0) {
      initialDocs = rows.map((r) => ({ documentId: r.id, fileName: r.fileName, fileUrl: r.fileUrl }));
      initialCustomer = {
        name: rows[0].clientName || undefined,
        email: rows[0].clientEmail || undefined,
        phone: rows[0].clientPhone || undefined,
      };
    }
  }

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
          {lead && (
            <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {lead.priceCents
                ? `${lead.miembroNombre || "El traductor"} propuso ${(lead.priceCents / 100).toFixed(2)} €${lead.plazoDias ? ` · ${lead.plazoDias} días` : ""} (${lead.par}). Coste ya puesto en la línea; neto de cliente 75/25 sugerido: ${(lead.priceCents / 0.75 / 100).toFixed(2)} € + IVA.`
                : `Solicitud ${lead.par} enviada a lavori; el traductor aún no ha pasado precio.`}
              {" "}Al crear el presupuesto queda atado a esta solicitud: el pago avisará al traductor.
              {lead.docsCount > 0 ? " Suelta aquí los documentos del cliente (no hay expediente)." : ""}
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
          initialData={expRef ? undefined : builderInitialConLead}
          expedienteRef={expRef}
          lavoriLeadRef={lead?.ref ?? null}
          emailContext={
            inboundEmail
              ? { id: inboundEmail.id, fromName: inboundEmail.fromName, fromEmail: inboundEmail.fromEmail, subject: inboundEmail.subject }
              : null
          }
        />
      </div>
    </div>
  );
}

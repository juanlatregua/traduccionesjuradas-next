import type { Metadata } from "next";
import Link from "next/link";
import ZonaTraductorSubNav from "@/components/ZonaTraductorSubNav";
import DiscardLavoriLeadButton from "@/components/DiscardLavoriLeadButton";
import RetireLavoriLeadButton from "@/components/RetireLavoriLeadButton";
import { LIVE_WINDOW_DAYS } from "@/lib/lavori-dup-guard";
import { authZonaTraductorOrRedirect, countExpedientesPendientes } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/quotes";
import { FileText, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Zona traductor — Presupuestos",
  robots: { index: false, follow: false },
};

const STATUS_BADGE: Record<QuoteStatus, string> = {
  DRAFT: "bg-slate-500/15 text-slate-300",
  SENT: "bg-sky-500/15 text-sky-300",
  OPENED: "bg-amber-500/15 text-amber-300",
  ACCEPTED: "bg-violet-500/15 text-violet-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
  IN_PROGRESS: "bg-cyan-500/15 text-cyan-300",
  DELIVERED: "bg-teal-500/15 text-teal-300",
  EXPIRED: "bg-rose-500/15 text-rose-300",
};

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

type Props = { searchParams?: { q?: string } };

export default async function ZonaTraductorPresupuestosPage({ searchParams }: Props) {
  await authZonaTraductorOrRedirect();
  const expedientesPendientes = await countExpedientesPendientes();

  const q = (searchParams?.q || "").trim();

  const quoteWhere: any = {};
  if (q) {
    quoteWhere.OR = [
      { quoteNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where: quoteWhere,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      customerName: true,
      customerEmail: true,
      total: true,
      issuedAt: true,
      pdfUrl: true,
      expedienteRef: true,
      deletedAt: true,
      orders: { select: { reference: true } },
    },
  });

  const expTokens = quotes
    .filter((quote) => quote.expedienteRef)
    .map((quote) => `exp:${quote.expedienteRef}`);
  const docs = expTokens.length
    ? await prisma.documentAnalysis.findMany({
        where: { sessionToken: { in: expTokens } },
        orderBy: { createdAt: "asc" },
        select: { sessionToken: true, fileName: true, fileUrl: true, fileSize: true },
      })
    : [];
  const docsByToken = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (!doc.sessionToken) continue;
    const list = docsByToken.get(doc.sessionToken);
    if (list) list.push(doc);
    else docsByToken.set(doc.sessionToken, [doc]);
  }

  // Solicitudes de precio en lavori aun sin presupuesto: viven en BD + un email de
  // staff; sin este bloque, la propuesta del traductor no se veia en ningun sitio
  // (20-ago, Juan: "en tj.net no veo el presupuesto").
  const lavoriLeads = await prisma.lavoriPriceRequest.findMany({
    where: { quoteId: null, status: { in: ["SENT", "PRICED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  // Encargos vivos en lavori que ya no salen arriba (con presupuesto, aceptados o
  // reabiertos sin retirar): aquí está su salida, «Retirar en lavori» (24-sep).
  const lavoriVivos = (
    await prisma.lavoriPriceRequest.findMany({
      where: {
        encargoId: { not: null },
        OR: [{ status: { in: ["ACCEPTED", "ESCALATED"] } }, { status: { in: ["SENT", "PRICED"] }, quoteId: { not: null } }],
        // Misma ventana que el freno (lib/lavori-dup-guard.ts): todo lo que frena se ve aquí.
        createdAt: { gte: new Date(Date.now() - LIVE_WINDOW_DAYS * 24 * 3_600_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
  ).sort((a, b) => Number(b.status === "ESCALATED") - Number(a.status === "ESCALATED"));

  const invoiceQuoteWhere: any = { docKind: "quote" };
  if (q) {
    invoiceQuoteWhere.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { clientName: { contains: q, mode: "insensitive" } },
      { fiscalName: { contains: q, mode: "insensitive" } },
    ];
  }
  const invoiceQuotes = await prisma.clientInvoice.findMany({
    where: invoiceQuoteWhere,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      clientName: true,
      fiscalName: true,
      concept: true,
      totalCents: true,
      issuedAt: true,
      createdAt: true,
      paidAt: true,
      order: { select: { reference: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ZonaTraductorSubNav
          tabs={[
            { href: "/zona-traductor/presupuestos", label: "Carpeta" },
            { href: "/zona-traductor/expedientes", label: "Expedientes", badge: expedientesPendientes },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Presupuestos</h1>
            <p className="mt-1 text-sm text-slate-400">
              Carpeta de presupuestos: cada uno con sus documentos fuente, su PDF y su pedido si existe.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/zona-traductor/tarifario"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Tarifario aprendido
            </Link>
            <Link
              href="/zona-traductor/presupuesto"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              + Nuevo presupuesto
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <form method="get" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por número o cliente…"
              className="w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Buscar
            </button>
          </form>
        </div>

        {lavoriLeads.length > 0 && (
          <section className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                Solicitudes de precio en lavori · sin presupuesto ({lavoriLeads.length})
              </h2>
              <span className="text-xs text-slate-500">Primero las que ya tienen precio: «Montar presupuesto» abre el builder atado a la solicitud. Las que esperan precio se abren para reclamar o cambiar de candidato.</span>
            </div>
            <div className="mt-3 space-y-2">
              {lavoriLeads.map((lead) => {
                const priced = lead.status === "PRICED" && lead.priceCents;
                const href = `/zona-traductor/presupuesto?lead=${encodeURIComponent(lead.ref)}${lead.expedienteRef && !lead.expedienteRef.startsWith("puerta:") ? `&exp=${encodeURIComponent(lead.expedienteRef)}` : ""}`;
                return (
                  <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-cyan-300">{lead.ref}</span>
                        <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs font-semibold text-slate-200">{lead.par}</span>
                        {priced ? (
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            {lead.miembroNombre || "Traductor"}: {(lead.priceCents! / 100).toFixed(2)} €{lead.plazoDias ? ` · ${lead.plazoDias} días` : ""}
                          </span>
                        ) : (
                          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            esperando precio · {lead.candidatos.length} candidato{lead.candidatos.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-200">{lead.customerHint || "(cliente sin identificar)"}</div>
                      <div className="text-xs text-slate-500">
                        {lead.docsCount} doc{lead.docsCount === 1 ? "" : "s"}{lead.words ? ` · ~${lead.words} palabras` : ""} · {formatDate(lead.createdAt)}
                        {priced ? ` · neto 75/25 sugerido: ${(lead.priceCents! / 0.75 / 100).toFixed(2)} € + IVA` : ""}
                        {lead.expedienteRef?.startsWith("puerta:") ? " · documentos de la puerta (entran solos en el builder)" : lead.expedienteRef ? ` · exp. ${lead.expedienteRef}` : " · sin expediente (suelta los PDF en el builder)"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {priced ? (
                        <Link href={href} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                          Montar presupuesto
                        </Link>
                      ) : (
                        <Link
                          href={href}
                          className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                          title="Aún no hay precio del jurado: ábrela para reclamarlo o cambiar de candidato"
                        >
                          Esperando precio · abrir
                        </Link>
                      )}
                      <DiscardLavoriLeadButton id={lead.id} leadRef={lead.ref} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {lavoriVivos.length > 0 && (
          <details className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-rose-300">
              Encargos vivos en lavori con presupuesto, aceptados o reabiertos ({lavoriVivos.length})
            </summary>
            <p className="mt-2 text-xs text-slate-500">Si uno sobra (duplicado, cliente perdido, otro jurado), retíralo aquí: lavori lo cancela sin avisar a nadie. Si un jurado ya lo tiene, te dice quién.</p>
            <div className="mt-3 space-y-2">
              {lavoriVivos.map((lead) => (
                <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-mono font-semibold text-cyan-300">{lead.ref}</span>{" "}
                    <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs font-semibold text-slate-200">{lead.par}</span>{" "}
                    <span className="text-xs font-semibold text-amber-300">
                      {lead.status === "ESCALATED" ? "reabierta sin retirar" : lead.status === "ACCEPTED" ? `aceptada${lead.miembroNombre ? ` · ${lead.miembroNombre}` : ""}` : lead.status === "PRICED" ? `con precio${lead.miembroNombre ? ` · ${lead.miembroNombre}` : ""}` : "esperando precio"}
                      {lead.quoteId ? " · con presupuesto" : ""}
                    </span>
                    <div className="text-xs text-slate-400">{lead.customerHint || "(cliente sin identificar)"} · {formatDate(lead.createdAt)}</div>
                  </div>
                  <RetireLavoriLeadButton id={lead.id} leadRef={lead.ref} />
                </div>
              ))}
            </div>
          </details>
        )}

        {quotes.length === 0 ? (
          <p className="mt-10 text-slate-500">
            {q ? `Sin resultados para «${q}».` : "No hay presupuestos todavía."}
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {quotes.map((quote) => {
              const quoteDocs = quote.expedienteRef
                ? docsByToken.get(`exp:${quote.expedienteRef}`) || []
                : [];
              const status = quote.status as QuoteStatus;
              return (
                <div key={quote.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-base font-semibold text-cyan-300">{quote.quoteNumber}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[status] || STATUS_BADGE.DRAFT}`}>
                        {QUOTE_STATUS_LABELS[status] || status}
                      </span>
                      {quote.deletedAt && (
                        <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">
                          Eliminado
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold tabular-nums text-white">
                        {decimalToNumber(quote.total).toFixed(2)} €
                      </div>
                      <div className="text-xs text-slate-500">{formatDate(quote.issuedAt)}</div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="text-sm text-slate-200">{quote.customerName}</div>
                    <div className="text-xs text-slate-500">{quote.customerEmail}</div>
                  </div>

                  {quoteDocs.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Documentos fuente ({quote.expedienteRef})
                      </div>
                      <ul className="mt-2 space-y-1">
                        {quoteDocs.map((doc, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-slate-300 hover:text-cyan-300 hover:underline"
                            >
                              {doc.fileName}
                            </a>
                            <span className="shrink-0 text-xs tabular-nums text-slate-500">
                              {formatBytes(doc.fileSize)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <a
                      href={quote.pdfUrl || `/api/quotes/${quote.id}/preview-pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      <FileText className="h-3.5 w-3.5" /> Ver PDF{quote.pdfUrl ? "" : " (borrador)"}
                    </a>
                    <Link
                      href={`/zona-traductor/presupuestos/${quote.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Detalle
                    </Link>
                    {quote.orders.map((order) => (
                      <Link
                        key={order.reference}
                        href={`/zona-traductor/pedido/${order.reference}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-700/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-700/60"
                      >
                        Pedido {order.reference}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white">Presupuestos del módulo de facturas</h2>
          <p className="mt-1 text-sm text-slate-400">
            Emitidos con serie propia P·AA_NNN desde Facturas (docKind «quote»). No son facturas ni entran en contabilidad.
          </p>
          {invoiceQuotes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {q ? `Sin resultados para «${q}».` : "Ninguno."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm text-slate-200">
                <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Número</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Concepto</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invoiceQuotes.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-mono text-cyan-300">{inv.number || "borrador"}</td>
                      <td className="px-4 py-3">
                        <div className="text-white">{inv.fiscalName}</div>
                        {inv.clientName && <div className="text-xs text-slate-400">{inv.clientName}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{inv.concept || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(inv.totalCents / 100).toFixed(2)} €</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(inv.issuedAt || inv.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            Ver PDF
                          </a>
                          {inv.order?.reference && (
                            <Link
                              href={`/zona-traductor/pedido/${inv.order.reference}`}
                              className="rounded-lg bg-cyan-700/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-700/60"
                            >
                              Pedido
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

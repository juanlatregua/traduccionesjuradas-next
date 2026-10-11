import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CasoAccionPaso from "@/components/CasoAccionPaso";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import {
  siguientePaso,
  quoteVigente,
  quienEspera,
  hrefCaso,
  hrefPedido,
  hrefPresupuesto,
  hrefSolicitud,
  urlPublicaQuote,
  type GrupoPaso,
} from "@/lib/caso/siguiente-paso";
import { QUOTE_PASO_SELECT, LPR_PASO_SELECT, PEDIDO_PASO_SELECT, nombreMiembro, baseUrlStaff, ESTADO_PILL, ESTADO_LABEL } from "@/lib/caso/vista";

export const metadata: Metadata = {
  title: "Zona traductor — Caso",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

const PASO_CLS: Record<GrupoPaso, string> = {
  accion: "border-amber-500/40 bg-amber-500/10",
  jurado: "border-sky-500/30 bg-sky-500/5",
  cliente: "border-violet-500/30 bg-violet-500/5",
  en_curso: "border-emerald-500/30 bg-emerald-500/5",
  cerrado: "border-slate-700 bg-slate-900/60",
};

type Hito = { at: Date; tipo: string; titulo: string; detalle?: string; href?: string };
type Ev = { con?: string[]; regla?: string; entrada?: string; de?: string; a?: string; motivo?: string | null; solicitud?: string | null; docsNuevos?: string[]; refs?: string[] };

const ENTRADA: Record<string, string> = { whatsapp: "WhatsApp", email: "email (hola@)", puerta: "puerta web" };

export default async function CasoFichaPage({ params }: { params: { id: string } }) {
  await authZonaTraductorOrRedirect();

  const caso = await prisma.caso.findFirst({
    where: { OR: [{ id: params.id }, { ref: params.id.toUpperCase() }] },
    select: {
      id: true,
      ref: true,
      estado: true,
      nombre: true,
      email: true,
      phone9: true,
      pares: true,
      origen: true,
      esAgencia: true,
      dudoso: true,
      createdAt: true,
      lastActivityAt: true,
      quotes: {
        orderBy: { createdAt: "asc" },
        select: { ...QUOTE_PASO_SELECT, total: true, vatAmount: true, expiredAt: true, autoPricedBy: true, translatorName: true, lavoriMiembroNombre: true },
      },
      priceRequests: { orderBy: { createdAt: "asc" }, select: { ...LPR_PASO_SELECT, id: true, plazoDias: true, updatedAt: true, docsCount: true, words: true } },
      orders: {
        orderBy: { createdAt: "asc" },
        select: {
          ...PEDIDO_PASO_SELECT,
          id: true,
          createdAt: true,
          paidAt: true,
          amountCents: true,
          supplierCostCents: true,
          assignedTo: true,
          quote: { select: { total: true, vatAmount: true } },
          collaboratorAssignments: { where: { isWinning: true }, take: 1, select: { collaborator: { select: { fullName: true } } } },
        },
      },
      inbound: { orderBy: { receivedAt: "asc" }, take: 50, select: { id: true, channel: true, receivedAt: true, subject: true, fromEmail: true } },
      analyses: { orderBy: { createdAt: "asc" }, take: 100, select: { sessionToken: true, source: true, fileName: true, createdAt: true } },
      eventos: {
        where: { tipo: { notIn: ["comparacion", "veredicto"] } },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { tipo: true, actor: true, createdAt: true, payload: true },
      },
      _count: { select: { eventos: { where: { tipo: "comparacion" } } } },
    },
  });
  if (!caso) notFound();

  const ahora = new Date();
  const baseUrl = baseUrlStaff();
  const sesiones = new Map<string, { at: Date; source: string | null; files: string[] }>();
  for (const a of caso.analyses) {
    const k = a.sessionToken || `suelto:${a.createdAt.toISOString()}`;
    const s = sesiones.get(k) || { at: a.createdAt, source: a.source, files: [] };
    s.files.push(a.fileName);
    sesiones.set(k, s);
  }
  const ultimaSesion = [...sesiones.keys()].reverse().find((k) => !k.startsWith("suelto:") && !k.startsWith("exp:")) || null;
  const paso = siguientePaso({
    casoId: caso.id,
    estado: caso.estado,
    quotes: caso.quotes,
    lprs: caso.priceRequests,
    pedidos: caso.orders,
    baseUrl,
    ahora,
    sesion: ultimaSesion,
    nombreDe: nombreMiembro,
  });

  const idsPosibles = [...new Set(caso.eventos.filter((e) => e.tipo === "posible").flatMap((e) => (e.payload as Ev | null)?.con || []))];
  const posibles = idsPosibles.length
    ? await prisma.caso.findMany({ where: { id: { in: idsPosibles } }, select: { id: true, ref: true, estado: true } })
    : [];

  const canales = new Set<string>();
  for (const s of sesiones.values()) canales.add(s.source === "whatsapp" ? "WhatsApp" : "puerta web");
  for (const m of caso.inbound) canales.add(m.channel === "WHATSAPP" ? "WhatsApp" : "email");
  if (caso.priceRequests.length) canales.add("lavori");

  const hitos: Hito[] = [];
  for (const s of sesiones.values()) {
    hitos.push({
      at: s.at,
      tipo: "entrada",
      titulo: `Entrada por ${s.source === "whatsapp" ? "WhatsApp" : s.source === "staff" ? "el constructor" : "la puerta web"}`,
      detalle: `${s.files.length} documento${s.files.length === 1 ? "" : "s"}: ${s.files.slice(0, 4).join(", ")}${s.files.length > 4 ? "…" : ""}`,
    });
  }
  for (const m of caso.inbound) {
    hitos.push({ at: m.receivedAt, tipo: "entrada", titulo: `${m.channel === "WHATSAPP" ? "WhatsApp" : "Email"} de ${m.fromEmail}`, detalle: m.subject, href: `/admin/inbox?vista=todos&canal=${m.channel === "WHATSAPP" ? "whatsapp" : "email"}` });
  }
  for (const l of caso.priceRequests) {
    hitos.push({
      at: l.createdAt,
      tipo: "lavori",
      titulo: `Solicitud ${l.ref} a ${quienEspera(l, nombreMiembro)}`,
      detalle: `${l.par} · ${l.docsCount} doc${l.words ? ` · ~${l.words} palabras` : ""} · ${l.status}`,
      href: hrefSolicitud(l),
    });
    if (l.priceCents) {
      hitos.push({
        at: l.updatedAt,
        tipo: "lavori",
        titulo: `Precio de ${l.miembroNombre || "el jurado"}: ${eur(l.priceCents / 100)}${l.plazoDias ? ` · ${l.plazoDias} días` : ""}`,
        detalle: `${l.ref} · ${l.status}`,
        href: hrefSolicitud(l),
      });
    }
  }
  for (const q of caso.quotes) {
    const href = hrefPresupuesto(q.id);
    const total = eur(decimalToNumber(q.total));
    hitos.push({ at: q.createdAt, tipo: "presupuesto", titulo: `Presupuesto ${q.quoteNumber} creado${q.autoPricedBy ? " (tarifario)" : ""}`, detalle: total, href });
    if (q.sentAt) hitos.push({ at: q.sentAt, tipo: "presupuesto", titulo: `${q.quoteNumber} enviado al cliente`, detalle: total, href });
    if (q.openedAt) hitos.push({ at: q.openedAt, tipo: "presupuesto", titulo: `${q.quoteNumber} abierto por el cliente`, href });
    if (q.paymentFrozenAt) hitos.push({ at: q.paymentFrozenAt, tipo: "alerta", titulo: `${q.quoteNumber}: pago congelado`, href });
    if (q.paidAt) hitos.push({ at: q.paidAt, tipo: "pedido", titulo: `${q.quoteNumber} pagado`, detalle: total, href });
    if (q.expiredAt) hitos.push({ at: q.expiredAt, tipo: "presupuesto", titulo: `${q.quoteNumber} caducado`, href });
    if (q.supersededAt) hitos.push({ at: q.supersededAt, tipo: "presupuesto", titulo: `${q.quoteNumber} sustituido`, href });
    if (q.deletedAt) hitos.push({ at: q.deletedAt, tipo: "presupuesto", titulo: `${q.quoteNumber} eliminado`, href });
  }
  for (const o of caso.orders) {
    const traductor = o.collaboratorAssignments[0]?.collaborator.fullName || o.assignedTo;
    hitos.push({
      at: o.createdAt,
      tipo: "pedido",
      titulo: `Pedido ${o.reference}`,
      detalle: `${eur(o.amountCents / 100)} · ${o.status}${traductor ? ` · ${traductor}` : ""}`,
      href: hrefPedido(o.reference),
    });
  }
  for (const e of caso.eventos) {
    const p = (e.payload || {}) as Ev;
    const t =
      e.tipo === "creado"
        ? { titulo: `Caso creado (${ENTRADA[p.entrada || ""] || p.entrada || caso.origen})`, detalle: p.regla }
        : e.tipo === "adjuntado"
          ? { titulo: `Añadido al caso desde ${ENTRADA[p.entrada || ""] || p.entrada || "?"}`, detalle: p.regla }
          : e.tipo === "posible"
            ? { titulo: "Puede ser el mismo encargo que otro caso", detalle: p.regla }
            : e.tipo === "transicion"
              ? { titulo: `Estado ${ESTADO_LABEL[p.de || ""] || p.de} → ${ESTADO_LABEL[p.a || ""] || p.a}`, detalle: p.motivo || undefined }
              : e.tipo === "aviso_humano"
                ? { titulo: "Aviso a staff: pide presupuesto humano", detalle: p.solicitud ? `con ${p.solicitud}` : undefined }
                : e.tipo === "aviso_humano_repetido"
                  ? { titulo: "El cliente ha vuelto a pedir (aviso corto)" }
                  : e.tipo === "backfill"
                    ? { titulo: "Caso reconstruido desde el histórico", detalle: (p.refs || []).join(", ") }
                    : e.tipo === "fallo_resolver"
                      ? { titulo: "Fallo del resolver" }
                      : { titulo: e.tipo };
    hitos.push({ at: e.createdAt, tipo: "caso", ...t });
  }
  hitos.sort((a, b) => a.at.getTime() - b.at.getTime());

  const lpr = caso.priceRequests[caso.priceRequests.length - 1];
  const vigente = quoteVigente(caso.id, caso.quotes) || caso.quotes.filter((q) => !q.deletedAt).slice(-1)[0] || null;
  const pedido = caso.orders[caso.orders.length - 1];
  const traductor = pedido ? pedido.collaboratorAssignments[0]?.collaborator.fullName || pedido.assignedTo : null;
  const neto = pedido?.quote ? decimalToNumber(pedido.quote.total) - decimalToNumber(pedido.quote.vatAmount) : null;
  const margen = neto != null && pedido?.supplierCostCents != null ? neto - pedido.supplierCostCents / 100 : null;

  const DOT: Record<string, string> = { entrada: "bg-sky-400", lavori: "bg-emerald-400", presupuesto: "bg-cyan-400", pedido: "bg-violet-400", alerta: "bg-rose-500", caso: "bg-slate-500" };

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/zona-traductor/casos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Casos
        </Link>

        <header className="mt-3 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-bold text-cyan-300">{caso.ref}</h1>
            {caso.pares.map((p) => (
              <span key={p} className="rounded bg-slate-700/60 px-2 py-0.5 text-xs font-semibold text-slate-200">
                {p}
              </span>
            ))}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_PILL[caso.estado] || ESTADO_PILL.PERDIDO}`}>{ESTADO_LABEL[caso.estado] || caso.estado}</span>
            {caso.esAgencia && <span className="rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">agencia</span>}
            {caso.dudoso && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">dudoso: revisar a mano</span>}
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{caso.nombre || "(sin nombre)"}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
            {caso.email && (
              <Link href={`/zona-traductor/clientes/${encodeURIComponent(caso.email)}`} className="text-cyan-400 hover:underline">
                {caso.email}
              </Link>
            )}
            {caso.phone9 && <a href={`https://wa.me/34${caso.phone9}`} className="text-cyan-400 hover:underline">+34 {caso.phone9}</a>}
            {canales.size > 0 && <span className="text-slate-400">Canales: {[...canales].join(" · ")}</span>}
            <span className="text-slate-500">desde {fmt(caso.createdAt)} · origen {caso.origen}</span>
          </div>
          {posibles.length > 0 && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Puede ser el mismo encargo que{" "}
              {posibles.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link href={hrefCaso(c.id)} className="font-mono underline hover:text-white">
                    {c.ref}
                  </Link>{" "}
                  ({ESTADO_LABEL[c.estado] || c.estado})
                </span>
              ))}
              . Unirlos llegará más adelante; de momento, revísalo a mano.
            </p>
          )}
        </header>

        <section className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 ${PASO_CLS[paso.grupo]}`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Qué toca ahora</div>
            <div className="mt-1 text-lg font-semibold text-white">{paso.titulo}</div>
            {paso.detalle && <div className="text-sm text-slate-300">{paso.detalle}</div>}
          </div>
          {paso.accion && <CasoAccionPaso {...paso.accion} />}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Historia del caso</h2>
            <ol className="relative space-y-3 border-l border-slate-800 pl-5">
              {hitos.map((h, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${DOT[h.tipo] || DOT.caso}`} />
                  <div className="text-xs text-slate-500">{fmt(h.at)}</div>
                  <div className="text-sm text-slate-100">
                    {h.href ? (
                      <Link href={h.href} className="hover:text-cyan-300 hover:underline">
                        {h.titulo}
                      </Link>
                    ) : (
                      h.titulo
                    )}
                  </div>
                  {h.detalle && <div className="text-xs text-slate-400">{h.detalle}</div>}
                </li>
              ))}
            </ol>
            {caso._count.eventos > 0 && (
              <p className="mt-4 text-xs text-slate-500">
                {caso._count.eventos} comparación{caso._count.eventos === 1 ? "" : "es"} guarda↔resolver en este caso:{" "}
                <Link href="/zona-traductor/casos/discrepancias" className="underline hover:text-slate-300">
                  ver discrepancias
                </Link>
                .
              </p>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Solicitud a lavori</h3>
              {lpr ? (
                <div className="mt-2 space-y-1 text-sm text-slate-200">
                  <Link href={hrefSolicitud(lpr)} className="font-mono text-cyan-300 hover:underline">
                    {lpr.ref}
                  </Link>{" "}
                  <span className="text-xs text-slate-400">· {lpr.par} · {lpr.status}</span>
                  <div className="text-xs text-slate-400">A {quienEspera(lpr, nombreMiembro)} · {fmt(lpr.createdAt)}</div>
                  <div>{lpr.priceCents ? `${eur(lpr.priceCents / 100)}${lpr.plazoDias ? ` · ${lpr.plazoDias} días` : ""}` : "Sin precio todavía"}</div>
                  {caso.priceRequests.length > 1 && <div className="text-xs text-amber-300">{caso.priceRequests.length} solicitudes en este caso</div>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Ninguna.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Presupuesto</h3>
              {vigente ? (
                <div className="mt-2 space-y-1 text-sm text-slate-200">
                  <Link href={hrefPresupuesto(vigente.id)} className="font-mono text-cyan-300 hover:underline">
                    {vigente.quoteNumber}
                  </Link>{" "}
                  <span className="text-xs text-slate-400">· {vigente.status}</span>
                  <div>{eur(decimalToNumber(vigente.total))} IVA incl.</div>
                  <div className="text-xs text-slate-400">
                    {vigente.sentAt ? `Enviado ${fmt(vigente.sentAt)}` : "Sin enviar"}
                    {vigente.openedAt ? ` · abierto ${fmt(vigente.openedAt)}` : vigente.sentAt ? " · sin abrir" : ""}
                  </div>
                  {vigente.paymentFrozenAt && <div className="text-xs font-semibold text-rose-300">Pago congelado</div>}
                  {vigente.sentAt && !vigente.deletedAt && (
                    <div className="pt-1">
                      <CasoAccionPaso label="Copiar enlace /q" href={urlPublicaQuote(baseUrl, vigente.publicToken)} copiar compacto />
                    </div>
                  )}
                  {caso.quotes.length > 1 && <div className="text-xs text-slate-500">{caso.quotes.length} presupuestos en este caso (ver historia)</div>}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Ninguno.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-300">Pedido</h3>
              {pedido ? (
                <div className="mt-2 space-y-1 text-sm text-slate-200">
                  <Link href={hrefPedido(pedido.reference)} className="font-mono text-cyan-300 hover:underline">
                    {pedido.reference}
                  </Link>{" "}
                  <span className="text-xs text-slate-400">· {pedido.status} · {pedido.deliveryState}</span>
                  <div className="text-xs text-slate-400">Traductor: {traductor || "sin asignar"}</div>
                  <div className="text-xs text-slate-400">
                    Cobro {eur(pedido.amountCents / 100)} · coste {pedido.supplierCostCents != null ? eur(pedido.supplierCostCents / 100) : "—"}
                  </div>
                  <div className={`text-xs font-semibold ${margen == null ? "text-slate-500" : margen <= 0 ? "text-rose-300" : "text-emerald-300"}`}>
                    {margen == null ? "Margen: sin presupuesto o coste para calcularlo" : `Margen ${eur(margen)} sobre ${eur(neto!)} netos`}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Todavía no.</p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

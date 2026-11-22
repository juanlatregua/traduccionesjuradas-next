import Link from "next/link";
import { decimalToNumber, QUOTE_STATUS_LABELS } from "@/lib/quotes";
import { documentTypeLabel } from "@/lib/document-labels";
import { deadlineLine } from "@/lib/needed-by";
import { hrefPedido, hrefPresupuesto, hrefSolicitud, quienEspera, quoteVigente, urlPublicaQuote } from "@/lib/caso/siguiente-paso";
import { quoteVivo } from "@/lib/caso/estados";
import { ESTADO_LABEL, nombreMiembro } from "@/lib/caso/vista";
import { costeDelPresupuesto, margenPedido } from "@/lib/caso/margen";
import { hrefCaso, hrefConstructor, hrefDiscrepancias } from "@/lib/staff-links";
import { sessionKeyOf } from "@/lib/entrada/store";
import type { Hito } from "@/lib/caso/hitos";
import { ETAPAS, canalDe, esPropio, etapasHechas, type PedidoMesa } from "@/lib/mesa/montones";
import type { cargarFicha } from "@/lib/mesa/datos";
import { MesaAccion, MesaCopiar, MesaEnlace } from "./MesaBoton";
import { Marca, Par, RelojMarca, Tarjeta, Titulo2, eur, fmtDia, fmtFecha, type Tono } from "./piezas";

export type Ficha = NonNullable<Awaited<ReturnType<typeof cargarFicha>>>;

const PEDIDO_LABEL: Record<string, string> = { PENDING_PAYMENT: "Pendiente de pago", PAID: "Pagado", IN_PROGRESS: "En curso", DELIVERED: "Entregado", CANCELLED: "Cancelado" };
const METODO: Record<string, string> = { REDSYS: "tarjeta (Redsys)", PAYPAL: "PayPal", BIZUM: "Bizum", TRANSFER: "transferencia", STRIPE: "tarjeta" };
const ASIGNACION: Record<string, string> = { REQUESTED: "Encargo enviado, sin respuesta", QUOTED: "Ha dado precio", QUOTE_REVISION_REQUESTED: "Precio en revisión", ACCEPTED: "Encargo aceptado", REJECTED: "Rechazado", DELIVERED: "Entregado por el jurado" };
const LPR_LABEL: Record<string, string> = { SENT: "Esperando precio", PRICED: "Precio recibido", ACCEPTED: "Aceptado", ESCALATED: "Escalado", RETIRING: "Retirándose", RETIRED: "Retirada" };
const ENTREGA_LABEL: Record<string, string> = { PRESUPUESTO: "Sin empezar", EN_PROCESO: "En traducción", TRADUCIDO: "Traducido" };
const DOT: Record<string, string> = { entrada: "bg-[#17477E]", lavori: "bg-[#1E5B2A]", presupuesto: "bg-[#472A7A]", pedido: "bg-[#0E4F55]", alerta: "bg-[#8B1E0F]", caso: "bg-[#9AA3AF]" };
const n = (v: unknown) => decimalToNumber(v);

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-[#52606D]">{k}</dt>
      <dd className="m-0 min-w-0 font-semibold [overflow-wrap:anywhere]">{v}</dd>
    </>
  );
}

function Carril({ titulo, quien, children }: { titulo: string; quien?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 grid gap-2 rounded-[12px] border border-[#D5DAE1] bg-[#fff] p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="text-[16px] font-bold text-[#1A2E4A]">{titulo}</h3>
        <span className="flex-1" />
        {quien && <span className="font-bold">{quien}</span>}
      </div>
      {children}
    </div>
  );
}

function ListaHitos({ hitos }: { hitos: Hito[] }) {
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {hitos.map((h, i) => (
        <li key={i} className="grid grid-cols-[10px_1fr] gap-2 text-[15px]">
          <span aria-hidden className={`mt-2 h-2.5 w-2.5 rounded-full ${DOT[h.tipo] || DOT.caso}`} />
          <span className="min-w-0">
            <span className="block text-[13px] text-[#52606D]">{fmtFecha(h.at)}</span>
            {h.href ? (
              <Link href={h.href} className="text-[#1F2933] underline-offset-2 hover:underline">
                {h.titulo}
              </Link>
            ) : (
              h.titulo
            )}
            {h.detalle && <span className="block text-[13px] text-[#52606D] [overflow-wrap:anywhere]">{h.detalle}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const Vacio = ({ children }: { children: React.ReactNode }) => <p className="text-[#52606D]">{children}</p>;

export default function FichaVista({ ficha, hitos, posibles, baseUrl }: { ficha: Ficha; hitos: Hito[]; posibles: { id: string; ref: string; estado: string }[]; baseUrl: string }) {
  const { caso, entradas, mesa, tarjeta, toca, ahora } = ficha;
  const pedidos = caso.orders.map((o, i) => ({ o, m: mesa.pedidos[i] as PedidoMesa }));
  const vivos = pedidos.filter(({ o }) => o.status !== "CANCELLED" && o.paymentStatus !== "REFUNDED");
  const quotes = caso.quotes.filter((q) => !q.deletedAt);
  const vigentes = quotes.filter((q) => quoteVivo(q) || q.paidAt || ["PAID", "IN_PROGRESS", "DELIVERED"].includes(q.status));
  const anteriores = quotes.filter((q) => !vigentes.includes(q));
  const vigente = quoteVigente(caso.id, caso.quotes);
  const hechas = etapasHechas({ entradas: caso.analyses.length + caso.inbound.length + entradas.length, quotes: caso.quotes, pedidos: mesa.pedidos });
  const deadline = caso.urgency || caso.neededBy ? deadlineLine({ urgency: caso.urgency, neededBy: caso.neededBy }, ahora) : null;
  const sesiones = new Map<string, typeof caso.analyses>();
  for (const a of caso.analyses) sesiones.set(a.sessionToken || a.id, [...(sesiones.get(a.sessionToken || a.id) || []), a]);
  const tel = caso.phone9 ? `+34 ${caso.phone9}` : null;
  const notas: { de: string; texto: string }[] = [
    ...(caso.customer?.notes ? [{ de: "Ficha del cliente", texto: caso.customer.notes }] : []),
    ...entradas.filter((e) => e.notas).map((e) => ({ de: `Entrada ${canalDe(e.canal)} · ${fmtFecha(e.createdAt)}`, texto: e.notas! })),
    ...caso.priceRequests.filter((l) => l.notas).map((l) => ({ de: `Del jurado (${l.ref})`, texto: l.notas! })),
    ...caso.orders.flatMap((o) => o.collaboratorAssignments.filter((a) => a.adminNotes).map((a) => ({ de: `Al jurado ${a.collaborator.fullName} (${o.reference})`, texto: a.adminNotes! }))),
    ...caso.orders.filter((o) => o.clientNotes).map((o) => ({ de: `Del cliente (${o.reference})`, texto: o.clientNotes! })),
  ];
  const canales = new Set<string>();
  for (const docs of sesiones.values()) canales.add(docs[0].source === "whatsapp" ? "WhatsApp" : "puerta web");
  for (const m of caso.inbound) canales.add(m.channel === "WHATSAPP" ? "WhatsApp" : "email");
  if (caso.priceRequests.length) canales.add("lavori");
  const recientes = [...hitos].reverse();
  const estadoTono: Tono = caso.estado === "ABIERTO" ? "info" : caso.estado === "EN_CURSO" ? "ok" : "gris";

  return (
    <div className="min-h-screen bg-[#F4F5F7] font-sans text-[16px] leading-[1.45] text-[#1F2933]">
      <main className="mx-auto max-w-[1280px] px-4 py-4">
        <p className="mb-2">
          <Link href="/zona-traductor/hoy" className="inline-flex min-h-[44px] items-center font-semibold text-[#17477E] underline">
            ← Volver a Hoy
          </Link>
        </p>

        <div className="mb-3 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-bold leading-tight text-[#1A2E4A]">{caso.nombre || caso.email || tel || "(sin identificar)"}</h1>
            <p className="text-[#52606D]">
              {caso.ref} · entró por {canalDe(caso.origen)} el {fmtFecha(caso.createdAt)}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              <Marca tono={estadoTono}>{ESTADO_LABEL[caso.estado] || caso.estado}</Marca>
              {caso.pares.map((p) => (
                <Par key={p} par={p} />
              ))}
              {tarjeta?.reloj && <RelojMarca reloj={tarjeta.reloj} />}
              {caso.dudoso && <Marca tono="warn">dudoso: revisar a mano</Marca>}
              {caso.esAgencia && <Marca tono="gris">agencia</Marca>}
            </p>
            <p className="mt-2 font-semibold">
              {toca.titulo}
              {toca.detalle ? <span className="font-normal text-[#52606D]"> · {toca.detalle}</span> : null}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
            {toca.accion && <MesaAccion {...toca.accion} variante={tarjeta ? "pri" : "sec"} className="flex-1 sm:flex-none" />}
            <details className="relative">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center rounded-[10px] border border-[#1A2E4A] bg-[#fff] px-4 font-semibold text-[#1A2E4A]">Más</summary>
              <ul className="absolute right-0 z-30 mt-1 grid min-w-[240px] list-none gap-0.5 rounded-[12px] border border-[#D5DAE1] bg-[#fff] p-1.5 shadow-lg">
                {caso.email && (
                  <li>
                    <a className="block min-h-[44px] rounded-lg px-3 py-2.5 text-[#1F2933] no-underline hover:bg-[#EEF2F7]" href={`mailto:${caso.email}`}>
                      Escribir al cliente (email)
                    </a>
                  </li>
                )}
                {caso.phone9 && (
                  <li>
                    <a className="block min-h-[44px] rounded-lg px-3 py-2.5 text-[#1F2933] no-underline hover:bg-[#EEF2F7]" href={`https://wa.me/34${caso.phone9}`}>
                      Abrir WhatsApp
                    </a>
                  </li>
                )}
                {caso.email && (
                  <li>
                    <Link className="block min-h-[44px] rounded-lg px-3 py-2.5 text-[#1F2933] no-underline hover:bg-[#EEF2F7]" href={`/zona-traductor/clientes/${encodeURIComponent(caso.email)}`}>
                      Ficha del cliente
                    </Link>
                  </li>
                )}
              </ul>
            </details>
          </div>
        </div>

        {posibles.length > 0 && (
          <p className="mb-3 rounded-[10px] border border-[#E3C877] bg-[#FCEFC9] px-3 py-2 text-[#4A2E00]">
            Puede ser el mismo encargo que{" "}
            {posibles.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={hrefCaso(c.id)} className="font-semibold underline">
                  {c.ref}
                </Link>{" "}
                ({ESTADO_LABEL[c.estado] || c.estado})
              </span>
            ))}
            . Unirlos todavía es a mano.
          </p>
        )}

        <nav aria-label="Etapas del caso" className="sticky top-[100px] z-20 mb-3.5 flex gap-1 overflow-x-auto rounded-[12px] border border-[#D5DAE1] bg-[#fff] p-1">
          {ETAPAS.map((e, i) => {
            const hecha = i < hechas;
            const actual = i === hechas;
            return (
              <a
                key={e.key}
                href={`#${e.key}`}
                aria-current={actual ? "step" : undefined}
                className={`flex min-h-[44px] min-w-max flex-1 items-center justify-center gap-2 rounded-[9px] px-3 font-semibold no-underline ${actual ? "bg-[#1A2E4A] text-[#fff]" : "text-[#52606D] hover:bg-[#EEF2F7]"}`}
              >
                <span aria-hidden className={`grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[13px] ${hecha ? "border-[#1E5B2A] bg-[#1E5B2A] text-[#fff]" : "border-current"}`}>
                  {hecha ? "✓" : i + 1}
                </span>
                <span className={actual ? "" : "hidden sm:inline"}>{e.titulo}</span>
                {hecha && <span className="sr-only"> (hecho)</span>}
              </a>
            );
          })}
        </nav>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-4">
            <Tarjeta id="solicitud">
              <Titulo2>Lo que ha enviado el cliente</Titulo2>
              {caso.inbound.map((m) => (
                <div key={m.id} className="mb-3">
                  <p className="text-[15px] font-semibold">
                    {m.channel === "WHATSAPP" ? "WhatsApp" : "Email"} · {fmtFecha(m.receivedAt)} · {m.subject}
                  </p>
                  <p className="line-clamp-4 whitespace-pre-wrap text-[15px]">{m.bodyPreview}</p>
                </div>
              ))}
              {entradas.map((e) => {
                const respuestas = Array.isArray(e.respuestasJson) ? (e.respuestasJson as { pregunta: string; respuesta: string }[]) : [];
                const q = new URLSearchParams({ session: sessionKeyOf(e.id) });
                if (e.email) q.set("customerEmail", e.email);
                if (e.nombre) q.set("customerName", e.nombre);
                if (e.phone9) q.set("customerPhone", e.phone9);
                return (
                  <div key={e.id} className="mb-3 text-[15px]">
                    <p>
                      <Marca tono="info">Puerta</Marca> {[e.organismo && `para ${e.organismo}`, e.pais && `país ${e.pais}`, e.source && `origen: ${e.source}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[14px] text-[#52606D]">
                      Abierta {fmtFecha(e.createdAt)} · {e.confirmedAt ? `confirmada ${fmtFecha(e.confirmedAt)}` : "sin confirmar"} · {e.estado}
                    </p>
                    {respuestas.length > 0 && (
                      <ul className="m-0 mt-1 grid list-none gap-0.5 p-0">
                        {respuestas.map((r, i) => (
                          <li key={i}>
                            {r.pregunta}: <b className="text-[#1A2E4A]">{r.respuesta}</b>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1.5">
                      <MesaEnlace label="Montar presupuesto (documentos dentro)" href={hrefConstructor(q)} variante="sec" que="el constructor" />
                    </div>
                  </div>
                );
              })}
              {[...sesiones.entries()].map(([k, docs]) => (
                <div key={k} className="mt-3">
                  <p className="mb-1 text-[15px] font-semibold">
                    {docs[0].source === "whatsapp" ? "Por WhatsApp" : docs[0].source === "staff" || k.startsWith("exp:") ? "Subido en el constructor" : "Subido en la web"} · {fmtFecha(docs[0].createdAt)} · {docs.length} {docs.length === 1 ? "archivo" : "archivos"}
                  </p>
                  <ul className="m-0 grid list-none gap-1.5 p-0">
                    {docs.map((d) => (
                      <li key={d.id} className="flex items-center gap-2.5 rounded-[10px] border border-[#D5DAE1] bg-[#fff] px-2.5 py-1.5">
                        <span aria-hidden className="relative h-[52px] w-10 flex-none rounded border border-[#9AA3AF] bg-[repeating-linear-gradient(#fff_0_5px,#CBD2D9_5px_6px)]">
                          <i className="absolute -bottom-1 -left-1 rounded bg-[#1A2E4A] px-1 text-[11px] font-bold not-italic text-[#fff]">{(d.sourceLanguage || "?").toUpperCase()}</i>
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold [overflow-wrap:anywhere]">{d.fileName}</span>
                          <span className="block text-[14px] text-[#52606D]">
                            {[documentTypeLabel(d.documentType), `${d.pageCount} ${d.pageCount === 1 ? "página" : "páginas"}`, d.estimatedWords ? `~${d.estimatedWords} palabras` : null, d.targetLanguage ? `a ${d.targetLanguage.toUpperCase()}` : null].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!caso.inbound.length && !caso.analyses.length && !entradas.length && <Vacio>No hay archivos ni mensajes atados a este caso.</Vacio>}
              <div className="mt-3.5 flex flex-wrap gap-2">
                {mesa.sesion && <MesaEnlace label="Abrir en el constructor" href={`/zona-traductor/presupuesto?session=${encodeURIComponent(mesa.sesion)}`} variante="sec" que="el constructor" />}
                {caso.inbound.length > 0 && <MesaEnlace label="Ver en la bandeja" href="/admin/inbox?vista=todos" variante="sec" que="la bandeja" />}
              </div>
            </Tarjeta>

            <Tarjeta id="presupuesto">
              <Titulo2>Presupuesto</Titulo2>
              {vigentes.length === 0 && <Vacio>Todavía no hay presupuesto.</Vacio>}
              {vigentes.map((q) => (
                <div key={q.id} className="mb-4 rounded-[14px] border border-[#D5DAE1]">
                  <div className="flex flex-wrap items-center gap-2.5 rounded-t-[14px] border-b border-[#D5DAE1] bg-[#F7F9FB] px-3.5 py-3">
                    <h3 className="font-bold text-[#1A2E4A]">
                      {q.sourceLang.toUpperCase()} → {q.targetLang.toUpperCase()}
                    </h3>
                    <span className="text-[#52606D]">
                      {q.quoteNumber} · {QUOTE_STATUS_LABELS[q.status]}
                      {q.autoPricedBy ? " · tarifario" : ""}
                    </span>
                    <span className="flex-1" />
                    {(q.translatorName || q.lavoriMiembroNombre) && (
                      <span className="text-[14px]">
                        Traduce: <b>{q.translatorName || q.lavoriMiembroNombre}</b>
                      </span>
                    )}
                  </div>
                  <ul className="m-0 list-none p-0">
                    {q.lines.map((l) => (
                      <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-[#E8EBEF] px-3.5 py-2 sm:grid-cols-[minmax(0,1fr)_70px_110px_110px]">
                        <span className="font-semibold [overflow-wrap:anywhere]">{l.description}</span>
                        <span className="hidden text-center text-[14px] text-[#52606D] sm:block">×{n(l.quantity)}</span>
                        <span className="text-right tabular-nums">{eur(n(l.lineTotal))}</span>
                        <span className="col-span-2 text-[14px] text-[#52606D] sm:col-span-1 sm:text-right">{l.supplierUnitCost != null ? `coste/ud. ${eur(n(l.supplierUnitCost))}` : "coste: —"}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="m-0 grid gap-1 px-3.5 py-2.5 text-[15px] [&>div]:flex [&>div]:justify-between">
                    <div>
                      <dt>Suma</dt>
                      <dd className="tabular-nums">{eur(n(q.subtotal))}</dd>
                    </div>
                    {n(q.discountAmount) > 0 && (
                      <div>
                        <dt>Descuento</dt>
                        <dd className="tabular-nums">−{eur(n(q.discountAmount))}</dd>
                      </div>
                    )}
                    {n(q.shippingAmount) > 0 && (
                      <div>
                        <dt>Envío en papel</dt>
                        <dd className="tabular-nums">{eur(n(q.shippingAmount))}</dd>
                      </div>
                    )}
                    <div>
                      <dt>IVA</dt>
                      <dd className="tabular-nums">{eur(n(q.vatAmount))}</dd>
                    </div>
                    <div className="border-t-2 border-[#1A2E4A] pt-2 text-[20px] font-bold text-[#1A2E4A]">
                      <dt>Total</dt>
                      <dd className="tabular-nums">{eur(n(q.total))}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3">
                    <span className="flex-1 text-[14px] text-[#52606D]">
                      {q.deliveryType === "PAPER_SHIP" ? "PDF + papel por mensajería" : "PDF con firma electrónica cualificada"}
                      {q.deliveryTerm ? ` · plazo ${q.deliveryTerm}` : ""}
                    </span>
                    <MesaEnlace label={q.status === "DRAFT" ? "Revisar y enviar" : "Abrir el presupuesto"} href={hrefPresupuesto(q.id)} variante={q.status === "DRAFT" ? "pri" : "sec"} que="el presupuesto" />
                  </div>
                </div>
              ))}
              {vigentes.length > 1 && (
                <p className="rounded-[10px] bg-[#FCEFC9] px-3 py-2 text-[15px] text-[#4A2E00]">
                  Hoy son {vigentes.length} presupuestos y {vigentes.length} pagos (uno por idioma). El pago único del caso llega con la fase siguiente.
                </p>
              )}
              {anteriores.length > 0 && (
                <details className="mt-2">
                  <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">
                    {anteriores.length} {anteriores.length === 1 ? "presupuesto anterior" : "presupuestos anteriores"} (sustituidos, caducados o no aceptados)
                  </summary>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {anteriores.map((q) => (
                      <li key={q.id}>
                        <Link href={hrefPresupuesto(q.id)} className="text-[#17477E] underline">
                          {q.quoteNumber}
                        </Link>{" "}
                        · {QUOTE_STATUS_LABELS[q.status]} · {eur(n(q.total))}
                        {q.supersededAt ? " · sustituido" : q.expiredAt ? " · caducado" : q.lostReason ? " · no aceptado" : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Tarjeta>

            <Tarjeta id="pago">
              <Titulo2>Pago</Titulo2>
              {!vigente && !vivos.length && !quotes.some((q) => q.paidAt) && <Vacio>Todavía no hay presupuesto enviado.</Vacio>}
              {quotes
                .filter((q) => q.paymentFrozenAt && !q.deletedAt)
                .map((q) => (
                  <p key={q.id} role="alert" className="mb-2 rounded-[10px] border-2 border-[#8B1E0F] bg-[#FBE4DF] px-3 py-2 text-[#5E130A]">
                    {q.quoteNumber}: pago congelado ({fmtFecha(q.paymentFrozenAt!)}). Decide en la ficha del presupuesto.
                  </p>
                ))}
              {vigente && vigente.status !== "DRAFT" && !vigente.paidAt && (
                <div className="mb-3">
                  <p>
                    <Marca tono="info">Esperando al cliente</Marca> {vigente.quoteNumber} {vigente.sentAt ? `enviado ${fmtFecha(vigente.sentAt)}` : ""} · {vigente.openedAt ? `abierto ${fmtFecha(vigente.openedAt)}` : "sin abrir todavía"}
                  </p>
                  <p className="mt-1 text-[14px] text-[#52606D]">Segundo contacto automático a las 24 h y, si no responde, se cierra sin bloquear el pago.</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <MesaCopiar label="Copiar enlace de pago" texto={urlPublicaQuote(baseUrl, vigente.publicToken)} variante="sec" />
                    <MesaEnlace label="Confirmar un pago" href={hrefPresupuesto(vigente.id)} variante="sec" que="el presupuesto" />
                  </div>
                </div>
              )}
              {vivos.map(({ o }) => {
                const hermanos = o.quoteId ? vivos.filter((v) => v.o.quoteId === o.quoteId).map((v) => v.o) : [o];
                const varios = hermanos.length > 1;
                const coste = varios ? costeDelPresupuesto(hermanos) : o.supplierCostCents;
                const { neto, margen } = margenPedido({ quoteTotal: o.quote ? n(o.quote.total) : null, quoteVat: o.quote ? n(o.quote.vatAmount) : null, supplierCostCents: coste });
                return (
                  <div key={o.id} className="mb-2">
                    <p>
                      <Marca tono={o.paymentStatus === "PAID" ? "ok" : "warn"}>{o.paymentStatus === "PAID" ? "Pagado" : PEDIDO_LABEL[o.status] || o.status}</Marca> {o.reference} · {eur(o.amountCents / 100)}
                      {o.paymentMethod ? ` · ${METODO[o.paymentMethod] || o.paymentMethod}` : ""}
                      {o.paidAt ? ` · ${fmtFecha(o.paidAt)}` : ""}
                      {o.paymentProofFileKey ? " · justificante subido (en el pedido)" : ""}
                    </p>
                    <p className="text-[14px] text-[#52606D]">
                      Cobro {eur(o.amountCents / 100)} · coste {o.supplierCostCents != null ? eur(o.supplierCostCents / 100) : "—"} ·{" "}
                      {varios && hermanos[0] !== o ? (
                        <span>margen: con {hermanos[0].reference} (presupuesto completo)</span>
                      ) : (
                        <b className={margen == null ? "text-[#52606D]" : margen <= 0 ? "text-[#A12B2B]" : "text-[#1F6B45]"}>
                          {margen == null ? "margen: sin presupuesto o coste para calcularlo" : `margen ${eur(margen)} sobre ${eur(neto!)} netos`}
                          {varios ? ` · margen del presupuesto completo (${hermanos.length} pedidos)` : ""}
                        </b>
                      )}
                    </p>
                  </div>
                );
              })}
              {vivos.some(({ o }) => o.paymentStatus === "PAID") && <p className="mt-1 text-[14px] text-[#52606D]">El pago no abre ningún encargo nuevo: los jurados dieron su precio antes de cobrar.</p>}
            </Tarjeta>

            <Tarjeta id="traduccion">
              <Titulo2>Quién traduce cada parte</Titulo2>
              {!vivos.length && !caso.priceRequests.length && <Vacio>Se activa cuando el pago está confirmado.</Vacio>}
              {vivos.map(({ o, m }) => {
                const propio = esPropio(m);
                const asignaciones = o.collaboratorAssignments;
                return (
                  <Carril key={o.id} titulo={o.langPair || o.title} quien={propio ? "Tú" : m.traductor || "Sin traductor"}>
                    <p>
                      {m.entregaJuradoAt ? (
                        <>
                          <Marca tono="warn">Entrega del jurado recibida</Marca> {fmtFecha(m.entregaJuradoAt)} · falta que la verifiques
                        </>
                      ) : propio ? (
                        <>
                          <Marca tono={o.paymentStatus === "PAID" ? "info" : "gris"}>{o.status === "DELIVERED" ? "Entregado" : "Lo traduces tú"}</Marca> {m.dueDate ? `entrega ${fmtDia(m.dueDate)}` : "sin fecha de entrega"}
                        </>
                      ) : m.traductor ? (
                        <>
                          <Marca tono="ok">{ASIGNACION[asignaciones.find((a) => a.collaborator.fullName === m.traductor)?.status || ""] || "Asignado"}</Marca>
                          {m.plazoJurado || m.dueDate ? ` entrega prevista ${fmtDia((m.plazoJurado || m.dueDate)!)}` : ""}
                        </>
                      ) : (
                        <Marca tono="bad">Sin traductor asignado</Marca>
                      )}
                    </p>
                    {asignaciones.length > 1 && (
                      <p className="text-[14px] text-[#52606D]">
                        {asignaciones.map((a) => `${a.collaborator.fullName}: ${ASIGNACION[a.status] || a.status}`).join(" · ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <MesaEnlace label={m.entregaJuradoAt ? "Verificar la entrega" : !propio && !m.traductor ? "Asignar traductor" : "Abrir el pedido"} href={hrefPedido(o.reference)} variante={m.entregaJuradoAt || (!propio && !m.traductor) ? "pri" : "sec"} que="el pedido" />
                    </div>
                  </Carril>
                );
              })}
              {caso.priceRequests.length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-3 text-[16px] font-bold text-[#1A2E4A]">Precio pedido a jurados (a ciegas)</h3>
                  {caso.priceRequests.map((l) => (
                    <Carril key={l.id} titulo={l.par} quien={quienEspera(l, nombreMiembro)}>
                      <p>
                        <Marca tono={l.status === "PRICED" ? "ok" : l.status === "SENT" ? "warn" : "gris"}>{LPR_LABEL[l.status] || l.status}</Marca> {l.priceCents ? `${eur(l.priceCents / 100)}${l.plazoDias ? ` · ${l.plazoDias} días` : ""}` : `pedido ${fmtFecha(l.createdAt)}`} · {l.ref}
                      </p>
                      <div>
                        <MesaEnlace label={l.status === "PRICED" && !l.quoteId ? "Montar presupuesto" : "Abrir la solicitud"} href={hrefSolicitud(l)} variante={l.status === "PRICED" && !l.quoteId ? "pri" : "sec"} que="el constructor" />
                      </div>
                    </Carril>
                  ))}
                </>
              )}
              <p className="text-[14px] text-[#52606D]">El cliente no ve quién traduce ni la red de jurados.</p>
            </Tarjeta>

            <Tarjeta id="entrega">
              <Titulo2>Entrega</Titulo2>
              {!vivos.length && <Vacio>Se activa cuando el pedido está en traducción.</Vacio>}
              {vivos.map(({ o, m }) => (
                <Carril
                  key={o.id}
                  titulo={o.reference}
                  quien={<Marca tono={o.status === "DELIVERED" ? "ok" : m.entregaJuradoAt ? "warn" : "info"}>{o.status === "DELIVERED" ? "Entregado al cliente" : m.entregaJuradoAt ? "Falta verificar y enviar" : ENTREGA_LABEL[o.deliveryState] || o.deliveryState}</Marca>}
                >
                  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
                    <Fila k="Fecha prometida" v={m.dueDate ? fmtDia(m.dueDate) : "sin fecha"} />
                    <Fila k="Formato" v={o.deliveryType === "paper" ? "PDF + papel por mensajería" : "PDF con firma electrónica cualificada"} />
                    {o.trackingNumber && <Fila k="Seguimiento" v={`${o.trackingNumber}${o.shippedAt ? ` · enviado ${fmtFecha(o.shippedAt)}` : ""}`} />}
                  </dl>
                  {o.status !== "DELIVERED" && (
                    <div>
                      <MesaEnlace label="Ir a la entrega" href={hrefPedido(o.reference)} variante={m.entregaJuradoAt ? "pri" : "sec"} que="el pedido" />
                    </div>
                  )}
                </Carril>
              ))}
            </Tarjeta>
          </div>

          <aside className="grid gap-3" aria-label="Datos, historial y notas">
            <Tarjeta>
              <Titulo2>Cliente y trámite</Titulo2>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
                <Fila
                  k="Contacto"
                  v={
                    <>
                      {caso.email ? (
                        <Link href={`/zona-traductor/clientes/${encodeURIComponent(caso.email)}`} className="text-[#17477E] underline">
                          {caso.email}
                        </Link>
                      ) : (
                        "Sin email"
                      )}
                      {tel && (
                        <>
                          <br />
                          <a href={`https://wa.me/34${caso.phone9}`} className="text-[#17477E] underline">
                            {tel}
                          </a>
                        </>
                      )}
                    </>
                  }
                />
                <Fila k="Entró por" v={`${canalDe(caso.origen)} · ${fmtFecha(caso.createdAt)}`} />
                {canales.size > 0 && <Fila k="Canales" v={[...canales].join(" · ")} />}
                <Fila k="Lo necesita" v={deadline ? deadline.replace(/^Lo necesita: /, "") : "Sin fecha: preguntarla"} />
                {entradas.find((e) => e.organismo) && <Fila k="Organismo" v={entradas.find((e) => e.organismo)!.organismo} />}
                {entradas.find((e) => e.pais) && <Fila k="País" v={entradas.find((e) => e.pais)!.pais} />}
                {entradas.find((e) => e.lang) && <Fila k="Le escribimos en" v={entradas.find((e) => e.lang)!.lang!.toUpperCase()} />}
                {caso.customer && (caso.customer.fiscalName || caso.customer.companyName) && <Fila k="Factura a" v={caso.customer.fiscalName || caso.customer.companyName} />}
              </dl>
            </Tarjeta>

            <Tarjeta>
              <Titulo2>Historial</Titulo2>
              <ListaHitos hitos={recientes.slice(0, 25)} />
              {recientes.length > 25 && (
                <details className="mt-2">
                  <summary className="min-h-[44px] cursor-pointer py-2 text-[14px] font-semibold text-[#17477E]">Ver la historia completa ({hitos.length} hitos)</summary>
                  <ListaHitos hitos={recientes.slice(25)} />
                </details>
              )}
              {caso._count.eventos > 0 && (
                <p className="mt-2 text-[14px] text-[#52606D]">
                  {caso._count.eventos} {caso._count.eventos === 1 ? "comparación" : "comparaciones"} guarda↔resolver en este caso:{" "}
                  <Link href={hrefDiscrepancias()} className="text-[#17477E] underline">
                    ver discrepancias
                  </Link>
                </p>
              )}
            </Tarjeta>

            <Tarjeta>
              <Titulo2>Notas internas</Titulo2>
              {notas.length ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {notas.map((x, i) => (
                    <li key={i} className="border-l-[3px] border-[#D5DAE1] pl-2 text-[15px]">
                      <span className="block text-[13px] font-semibold text-[#52606D]">{x.de}</span>
                      <span className="whitespace-pre-wrap">{x.texto}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio>Sin notas.</Vacio>
              )}
              <p className="mt-2 text-[13px] text-[#52606D]">El cliente no las ve. Escribir notas nuevas desde aquí llega en la fase siguiente.</p>
            </Tarjeta>
          </aside>
        </div>
      </main>
    </div>
  );
}

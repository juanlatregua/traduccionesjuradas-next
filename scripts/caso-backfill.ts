// scripts/caso-backfill.ts — Casos para el histórico (F1 del modelo «caso»).
//   npx tsx --env-file=.env.local scripts/caso-backfill.ts            # dry-run (por defecto): solo informe, NO escribe
//   npx tsx --env-file=.env.local scripts/caso-backfill.ts --apply    # escribe (requiere el schema con Caso y OK de Juan)
//   npx tsx --env-file=.env.local scripts/caso-backfill.ts verificar  # invariantes de liveCasoKey
//
// Dry-run: las lecturas van en una transacción SET TRANSACTION READ ONLY (Postgres
// rechaza cualquier escritura) y además el cliente lanza ante cualquier operación
// de escritura de modelo. Si la tabla Caso aún no existe (antes del db push), lee
// el histórico sin las columnas nuevas y lo trata todo como sin caso.

import { prisma as base } from "../lib/prisma";
import { getWorkflowState } from "../lib/workflow";
import { expedienteRefForInbound } from "../lib/inbox";
import { aliasDesdeEnv } from "../lib/caso/identidad";
import { puedeCaso, esCasoEstado } from "../lib/caso/estados";
import { planBackfill, casoCerradoEn, NOTA_SUSTITUIDO, type BackfillInput, type BackfillPlan, type BSesion } from "../lib/caso/backfill-plan";
import { nuevaRefCaso } from "../lib/caso/resolver-db";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERIFICAR = args.includes("verificar");
const LOTE = 50;
const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);

const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args: a, query }) {
        if (!APPLY && WRITE_OPS.has(operation)) throw new Error(`dry-run: escritura bloqueada (${model}.${operation})`);
        return query(a);
      },
    },
  },
});
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const sesionRef = (token: string) => (token.startsWith("exp:") ? token.slice(4) : `puerta:${token}`);

async function tieneCaso(tx: Tx): Promise<boolean> {
  const r = await tx.$queryRaw<{ t: string | null }[]>`SELECT to_regclass('public."Caso"')::text AS t`;
  return Boolean(r[0]?.t);
}

async function leer(tx: Tx): Promise<{ input: BackfillInput; hayCaso: boolean; analisisSinSesion: number; sesionesStaff: number }> {
  const hayCaso = await tieneCaso(tx);
  const [quotes, lprs, orders, analyses, inbound, customers] = await Promise.all([
    tx.quote.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, quoteNumber: true, status: true, deletedAt: true, customerId: true, customerEmail: true, customerPhone: true, customerName: true,
        sourceLang: true, targetLang: true, expedienteRef: true, holderNames: true, createdAt: true, paidAt: true, balanceAmount: true,
        balancePaidAt: true, lostReason: true, lostReasonNote: true, lines: { select: { sourceFileUrl: true } },
      },
    }),
    tx.lavoriPriceRequest.findMany({
      select: { id: true, ref: true, par: true, expedienteRef: true, customerHint: true, quoteId: true, status: true, contentKey: true, createdAt: true },
    }),
    tx.order.findMany({
      select: {
        id: true, reference: true, quoteId: true, clientEmail: true, clientPhone: true, clientName: true, langPair: true, createdAt: true,
        status: true, paymentStatus: true, deliveryState: true,
        events: { where: { type: "workflow.state_changed" }, select: { type: true, payload: true, createdAt: true } },
      },
    }),
    tx.documentAnalysis.findMany({ select: { id: true, sessionToken: true, fileHash: true, orderId: true, orderReference: true, createdAt: true } }),
    tx.inboundEmail.findMany({ select: { id: true, quoteId: true, orderReference: true, receivedAt: true } }),
    tx.customer.findMany({ select: { id: true, isBusiness: true, creditEnabled: true, billingCycle: true } }),
  ]);

  const caso = new Map<string, { casoId: string | null; liveCasoKey?: string | null; supersededAt?: Date | null }>();
  let casos: { id: string; estado: string }[] = [];
  if (hayCaso) {
    const [cq, cl, co, ca, ci, cs] = await Promise.all([
      tx.quote.findMany({ select: { id: true, casoId: true, liveCasoKey: true, supersededAt: true } }),
      tx.lavoriPriceRequest.findMany({ select: { id: true, casoId: true } }),
      tx.order.findMany({ select: { id: true, casoId: true } }),
      tx.documentAnalysis.findMany({ select: { id: true, casoId: true } }),
      tx.inboundEmail.findMany({ select: { id: true, casoId: true } }),
      tx.caso.findMany({ select: { id: true, estado: true } }),
    ]);
    for (const r of [...cq, ...cl, ...co, ...ca, ...ci]) caso.set(r.id, r);
    casos = cs;
  }
  const casoDe = (id: string) => caso.get(id)?.casoId ?? null;

  const sesiones = new Map<string, BSesion & { hashes: string[] }>();
  let analisisSinSesion = 0;
  const staff = new Set<string>();
  for (const a of analyses) {
    if (!a.sessionToken) { analisisSinSesion += 1; continue; }
    if (a.sessionToken.startsWith("staff:")) { staff.add(a.sessionToken); continue; }
    const s = sesiones.get(a.sessionToken) || { token: a.sessionToken, analysisIds: [], orderIds: [], orderRefs: [], casoIds: [], createdAt: a.createdAt, hashes: [] };
    const cid = casoDe(a.id);
    if (cid) s.casoIds.push(cid);
    else s.analysisIds.push(a.id);
    if (a.orderId) s.orderIds.push(a.orderId);
    if (a.orderReference) s.orderRefs.push(a.orderReference);
    if (a.fileHash) s.hashes.push(a.fileHash);
    sesiones.set(a.sessionToken, s);
  }
  const hashesPorRef = new Map<string, string[]>();
  for (const s of sesiones.values()) hashesPorRef.set(sesionRef(s.token), s.hashes);

  const input: BackfillInput = {
    ahora: new Date(),
    alias: aliasDesdeEnv(),
    propios: [process.env.EMAIL_FROM, process.env.ADMIN_EMAIL].filter((x): x is string => Boolean(x)),
    quotes: quotes.map((q) => ({
      ...q,
      balanceAmount: q.balanceAmount == null ? null : Number(q.balanceAmount),
      lostReason: q.lostReason ?? null,
      fileKeys: [...new Set([...q.lines.map((l) => l.sourceFileUrl).filter((x): x is string => Boolean(x)), ...(q.expedienteRef ? hashesPorRef.get(q.expedienteRef) || [] : [])])],
      casoId: casoDe(q.id),
      liveCasoKey: caso.get(q.id)?.liveCasoKey ?? null,
      supersededAt: caso.get(q.id)?.supersededAt ?? null,
    })),
    lprs: lprs.map((l) => ({ ...l, casoId: casoDe(l.id) })),
    orders: orders.map((o) => ({
      ...o,
      workflowState: getWorkflowState({ paymentStatus: o.paymentStatus, deliveryState: o.deliveryState, events: o.events }),
      casoId: casoDe(o.id),
    })),
    sesiones: [...sesiones.values()],
    inbound: inbound.map((m) => ({ ...m, expedienteRef: expedienteRefForInbound(m.id), casoId: casoDe(m.id) })),
    casos,
    customers,
  };
  return { input, hayCaso, analisisSinSesion, sesionesStaff: staff.size };
}

function informe(plan: BackfillPlan, extra: { hayCaso: boolean; analisisSinSesion: number; sesionesStaff: number; input: BackfillInput }): string {
  const L: string[] = [];
  const nuevos = plan.casos.filter((c) => c.nuevo);
  const porEstado = new Map<string, number>();
  for (const c of nuevos) porEstado.set(c.estado, (porEstado.get(c.estado) || 0) + 1);
  const multi = plan.casos.filter((c) => c.refs.filter((r) => /^\d{4}-\d{5}$/.test(r)).length >= 2);
  const dudosos = plan.casos.filter((c) => c.dudoso);
  const conPosibles = plan.casos.filter((c) => c.posibles.length && !c.dudoso);
  const name = (id: string) => (id.startsWith("nuevo:") ? `CASO#${id.slice(6)}` : id);
  const sinCasoPor = new Map<string, number>();
  for (const s of plan.sinCaso) sinCasoPor.set(`${s.tipo}: ${s.motivo}`, (sinCasoPor.get(`${s.tipo}: ${s.motivo}`) || 0) + 1);
  const i = extra.input;

  L.push(`# Backfill de casos — ${APPLY ? "APPLY" : "DRY-RUN (solo lectura)"} — ${i.ahora.toISOString()}`);
  L.push(`Tabla Caso en BD: ${extra.hayCaso ? "sí" : "NO (pre-schema: todo se trata como sin caso)"}`);
  L.push(`Leído: ${i.quotes.length} presupuestos (${i.quotes.filter((q) => q.deletedAt).length} en papelera), ${i.lprs.length} solicitudes, ${i.orders.length} pedidos, ${i.sesiones.length} sesiones con análisis, ${i.inbound.length} entrantes, ${i.casos.length} casos existentes`);
  L.push("");
  L.push(`Casos nuevos: ${nuevos.length} · existentes tocados: ${plan.casos.length - nuevos.length}`);
  L.push(`Por estado (nuevos): ${[...porEstado].map(([e, n]) => `${e} ${n}`).join(" · ")}`);
  const abiertos = plan.casos.filter((c) => c.estado === "ABIERTO");
  const vivos = new Set(i.quotes.filter((q) => !q.deletedAt && ["DRAFT", "SENT", "OPENED", "ACCEPTED"].includes(q.status)).map((q) => q.id));
  const conQuoteViva = abiertos.filter((c) => c.vigenteId && vivos.has(c.vigenteId)).length;
  L.push(`Abiertos: ${abiertos.length} (${conQuoteViva} con presupuesto vigente vivo, ${abiertos.length - conQuoteViva} solo por solicitud de precio viva ≤30 d)`);
  L.push(`Con 2+ presupuestos: ${multi.length} (máx. ${Math.max(0, ...multi.map((c) => c.refs.filter((r) => /^\d{4}-\d{5}$/.test(r)).length))})`);
  for (const c of multi) L.push(`  - ${name(c.id)} [${c.estado}] ${c.refs.join(" + ")}`);
  L.push(`Vigentes a fijar (liveCasoKey): ${plan.casos.filter((c) => c.vigenteId).length}`);
  L.push(`Sustituciones: ${plan.sustituciones.length} (supersededAt ${plan.sustituciones.filter((s) => s.supersededAt).length} · nota ${NOTA_SUSTITUIDO} ${plan.sustituciones.filter((s) => s.notaSustituido).length} · quitar clave ${plan.sustituciones.filter((s) => s.quitarClave).length}) — el status de ningún presupuesto cambia`);
  const vivasViejas = plan.sustituciones.filter((s) => s.sigueViva);
  L.push(`Versiones antiguas aún vivas (status sin tocar; revisar): ${vivasViejas.length}${vivasViejas.length ? " → " + vivasViejas.map((s) => s.quoteNumber).join(", ") : ""}`);
  L.push(`Conflictos de vigente resueltos (2+ presupuestos vivos/pagados en un caso): ${plan.conflictosVigente.length}`);
  for (const c of plan.conflictosVigente) L.push(`  - ${c}`);
  L.push(`Conflictos de ancla (casoId inexistente / sesión en 2 casos): ${plan.conflictosAncla.length}`);
  for (const c of plan.conflictosAncla) L.push(`  - ${c}`);
  L.push("");
  L.push(`DUDOSOS (caso propio marcado, sin fusionar): ${dudosos.length}`);
  for (const c of dudosos) L.push(`  - ${name(c.id)} [${c.estado}] ${c.refs.join(" + ") || "(sin refs)"} — ${c.motivos.join("; ")}${c.posibles.length ? ` — posible: ${c.posibles.map(name).join(", ")}` : ""}`);
  L.push(`Casos con «posible» enlazado (documento distinto / mismo teléfono): ${conPosibles.length}`);
  for (const c of conPosibles) L.push(`  - ${name(c.id)} ${c.refs.join(" + ")} — posible: ${c.posibles.map(name).join(", ")}`);
  L.push("");
  L.push(`Filas sin caso: ${plan.sinCaso.length + extra.analisisSinSesion} (+ ${extra.sesionesStaff} sesiones staff: ignoradas)`);
  for (const [k, n] of sinCasoPor) L.push(`  - ${k}: ${n}`);
  if (extra.analisisSinSesion) L.push(`  - análisis: sin sessionToken (no atribuible): ${extra.analisisSinSesion}`);
  const sinCasoPedidos = i.orders.filter((o) => !o.casoId && !plan.casos.some((c) => c.orderIds.includes(o.id))).length;
  const sinCasoQuotes = i.quotes.filter((q) => !q.casoId && !plan.casos.some((c) => c.quoteIds.includes(q.id))).length;
  const sinCasoLpr = i.lprs.filter((l) => !l.casoId && !plan.casos.some((c) => c.lprIds.includes(l.id))).length;
  L.push(`Pedidos sin caso: ${sinCasoPedidos} · presupuestos sin caso: ${sinCasoQuotes} · solicitudes sin caso: ${sinCasoLpr} (deben ser 0)`);
  return L.join("\n");
}

async function aplicar(plan: BackfillPlan) {
  const ids = new Map<string, string>();
  const real = (id: string) => ids.get(id) || id;
  const actor = "system:backfill";
  const sust = new Map<string, typeof plan.sustituciones>();
  for (const s of plan.sustituciones) sust.set(s.casoId, [...(sust.get(s.casoId) || []), s]);

  for (let i = 0; i < plan.casos.length; i += LOTE) {
    const lote = plan.casos.slice(i, i + LOTE);
    await prisma.$transaction(
      async (tx) => {
        for (const c of lote) {
          let casoId = c.id;
          if (c.nuevo) {
            const creado = await tx.caso.create({
              data: {
                ref: nuevaRefCaso(), estado: c.estado, identityKey: c.identityKey, email: c.email, phone9: c.phone9, nombre: c.nombre,
                pares: c.pares, origen: "backfill", esAgencia: c.esAgencia, dudoso: c.dudoso, customerId: c.customerId,
                lastActivityAt: c.lastActivityAt, closedAt: casoCerradoEn(c), createdAt: c.createdAt, createdBy: actor,
              },
              select: { id: true },
            });
            casoId = creado.id;
            ids.set(c.id, casoId);
          } else if (esCasoEstado(c.estadoAnterior) && c.estadoAnterior !== c.estado && puedeCaso(c.estadoAnterior, c.estado)) {
            await tx.caso.update({ where: { id: casoId }, data: { estado: c.estado, closedAt: casoCerradoEn(c) } });
            await tx.casoEvento.create({ data: { casoId, tipo: "transicion", actor, payload: { de: c.estadoAnterior, a: c.estado } } });
          }
          const nulo = { casoId: null };
          if (c.quoteIds.length) await tx.quote.updateMany({ where: { id: { in: c.quoteIds }, ...nulo }, data: { casoId } });
          if (c.lprIds.length) await tx.lavoriPriceRequest.updateMany({ where: { id: { in: c.lprIds }, ...nulo }, data: { casoId } });
          if (c.orderIds.length) await tx.order.updateMany({ where: { id: { in: c.orderIds }, ...nulo }, data: { casoId } });
          if (c.analysisIds.length) await tx.documentAnalysis.updateMany({ where: { id: { in: c.analysisIds }, ...nulo }, data: { casoId } });
          if (c.inboundIds.length) await tx.inboundEmail.updateMany({ where: { id: { in: c.inboundIds }, ...nulo }, data: { casoId } });

          // Primero se sueltan las claves (el @unique no admite dos vigentes), luego la vigente.
          for (const s of sust.get(c.id) || []) {
            if (s.quitarClave) await tx.quote.updateMany({ where: { id: s.quoteId, liveCasoKey: { not: null } }, data: { liveCasoKey: null } });
            if (s.supersededAt)
              await tx.quote.updateMany({
                where: { id: s.quoteId, supersededAt: null, paidAt: null, status: { in: ["DRAFT", "SENT", "OPENED", "ACCEPTED", "EXPIRED"] } },
                data: { supersededAt: s.supersededAt },
              });
            if (s.notaSustituido)
              await tx.quote.updateMany({ where: { id: s.quoteId, status: "EXPIRED", lostReason: null, lostReasonNote: null }, data: { lostReasonNote: NOTA_SUSTITUIDO } });
          }
          if (c.vigenteId) await tx.quote.updateMany({ where: { id: c.vigenteId, deletedAt: null, casoId }, data: { liveCasoKey: casoId } });
          await tx.casoEvento.create({
            data: { casoId, tipo: "backfill", actor, payload: { nuevo: c.nuevo, motivos: c.motivos, refs: c.refs } },
          });
        }
      },
      { timeout: 60_000 }
    );
    console.log(`lote ${i / LOTE + 1}: ${lote.length} casos`);
  }
  const conPosibles = plan.casos.filter((c) => c.posibles.length);
  for (let i = 0; i < conPosibles.length; i += LOTE) {
    await prisma.$transaction(
      conPosibles.slice(i, i + LOTE).map((c) =>
        prisma.casoEvento.create({ data: { casoId: real(c.id), tipo: "posible", actor, payload: { con: c.posibles.map(real) } } })
      )
    );
  }
}

async function verificar() {
  const malas = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Quote" WHERE "liveCasoKey" IS NOT NULL AND ("liveCasoKey" <> "casoId" OR "casoId" IS NULL OR "deletedAt" IS NOT NULL)`;
  const pedidos = await prisma.order.count({ where: { casoId: null } });
  const quotes = await prisma.quote.count({ where: { casoId: null } });
  console.log(`liveCasoKey fuera de {null, casoId} o en borrados: ${malas[0].n} · pedidos sin caso: ${pedidos} · presupuestos sin caso: ${quotes}`);
}

async function main() {
  if (VERIFICAR) return verificar();
  const leido = await prisma.$transaction(
    async (tx) => {
      if (!APPLY) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return leer(tx);
    },
    { timeout: 120_000 }
  );
  const plan = planBackfill(leido.input);
  console.log(informe(plan, leido));
  if (!APPLY) return;
  if (!leido.hayCaso) throw new Error("No existe la tabla Caso: aplica el schema (prisma db push) antes de --apply.");
  await aplicar(plan);
  await verificar();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => base.$disconnect());

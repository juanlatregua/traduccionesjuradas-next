// Deshace la prueba de Juan del 19-nov: su entrada web (juansilvamoreno@msn.com) se unió por huella al caso de
// Julián (testamento p1–p4). SECO por defecto; con --apply escribe en una transacción.
//   npx tsx --env-file=.env.local scripts/entrada-limpiar-prueba.ts [--apply]
// Hace: suelta la entrada, sus archivos y su lote del caso; borra los eventos que dejó en él; marca la entrada
// como «prueba» y los archivos de EXP-6VUFA3 (puerta vieja, juansilvamoreno@msn.omc) con source «prueba»,
// para que no salgan como leads, y cancela el caso que creó esa puerta si no tiene nada más.
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");
const EMAIL = "juansilvamoreno@msn.com";
const EXP_SESSION = "exp:EXP-6VUFA3";
const DAY = { gte: new Date("2026-11-19T00:00:00Z"), lt: new Date("2026-11-20T00:00:00Z") };

async function main() {
  const entradas = await prisma.entrada.findMany({ where: { email: EMAIL, createdAt: DAY }, select: { id: true, estado: true, casoId: true, loteId: true, regla: true } });
  const plan: string[] = [];
  const writes: (() => Promise<unknown>)[] = [];

  for (const e of entradas) {
    const session = `entrada:${e.id}`;
    const caso = e.casoId ? await prisma.caso.findUnique({ where: { id: e.casoId }, select: { id: true, ref: true, nombre: true, email: true, phone9: true, estado: true, lastActivityAt: true } }) : null;
    const files = await prisma.documentAnalysis.findMany({ where: { sessionToken: session }, select: { id: true, fileName: true, casoId: true } });
    const lotes = await prisma.lecturaLote.findMany({ where: { OR: [{ sessionKey: session }, ...(e.loteId ? [{ id: e.loteId }] : [])] }, select: { id: true, casoId: true, status: true, sessionKey: true } });
    const eventos = caso
      ? (await prisma.casoEvento.findMany({ where: { casoId: caso.id, createdAt: DAY }, select: { id: true, tipo: true, payload: true } })).filter((ev) => {
          const p = (ev.payload ?? {}) as Record<string, unknown>;
          return p.ancla === session || p.entradaId === e.id || (Array.isArray(p.con) && ev.tipo === "posible" && p.regla === e.regla);
        })
      : [];
    const relacionados = await prisma.casoEvento.findMany({ where: { tipo: "relacionado", createdAt: DAY, OR: [...(caso ? [{ casoId: caso.id }] : []), { actor: `cliente:${EMAIL}` }] }, select: { id: true, casoId: true } });

    plan.push(`entrada ${e.id} (${e.estado}, regla ${e.regla}) unida a ${caso ? `${caso.ref} «${caso.nombre ?? ""}» ${caso.email ?? ""} ${caso.phone9 ?? ""} ${caso.estado}` : "ningún caso"}`);
    plan.push(`  · ${files.length} archivo(s) → sin caso: ${files.map((f) => f.fileName).join(", ")}`);
    plan.push(`  · ${lotes.length} lote(s) → sin caso: ${lotes.map((l) => `${l.id} ${l.status}${l.sessionKey === session ? "" : " (AJENO: no se toca)"}`).join(", ")}`);
    plan.push(`  · ${eventos.length} evento(s) en el caso → borrar: ${eventos.map((ev) => ev.tipo).join(", ") || "—"}`);
    plan.push(`  · ${relacionados.length} evento(s) «relacionado» → borrar`);
    plan.push(`  · entrada → estado «prueba», sin caso; lastActivityAt del caso (${caso?.lastActivityAt.toISOString() ?? "—"}) no se puede restaurar con certeza: se deja`);

    writes.push(() => prisma.$transaction([
      prisma.documentAnalysis.updateMany({ where: { sessionToken: session }, data: { casoId: null, source: "prueba" } }),
      prisma.lecturaLote.updateMany({ where: { sessionKey: session }, data: { casoId: null } }),
      prisma.casoEvento.deleteMany({ where: { id: { in: [...eventos, ...relacionados].map((x) => x.id) } } }),
      prisma.entrada.updateMany({ where: { id: e.id }, data: { estado: "prueba", casoId: null, regla: null, posibles: [], relacionados: [] } }),
    ]));
  }
  if (entradas.length === 0) plan.push(`ninguna entrada de ${EMAIL} hoy`);

  const exp = await prisma.documentAnalysis.findMany({ where: { sessionToken: EXP_SESSION }, select: { id: true, fileName: true, clientEmail: true, casoId: true, source: true } });
  plan.push(`${EXP_SESSION}: ${exp.length} archivo(s) de ${[...new Set(exp.map((d) => d.clientEmail))].join(", ")} → source «prueba»`);
  writes.push(() => prisma.documentAnalysis.updateMany({ where: { sessionToken: EXP_SESSION }, data: { source: "prueba" } }));
  for (const casoId of [...new Set(exp.map((d) => d.casoId).filter((x): x is string => !!x))]) {
    const [caso, quotes, orders, lprs, otros, inbound] = await Promise.all([
      prisma.caso.findUnique({ where: { id: casoId }, select: { ref: true, estado: true } }),
      prisma.quote.count({ where: { casoId, deletedAt: null } }),
      prisma.order.count({ where: { casoId } }),
      prisma.lavoriPriceRequest.count({ where: { casoId } }),
      prisma.documentAnalysis.count({ where: { casoId, NOT: { sessionToken: EXP_SESSION } } }),
      prisma.inboundEmail.count({ where: { casoId } }),
    ]);
    const solo = quotes + orders + lprs + otros + inbound === 0;
    plan.push(`  · su caso ${caso?.ref} (${caso?.estado}): presupuestos ${quotes}, pedidos ${orders}, solicitudes ${lprs}, otros archivos ${otros}, entrantes ${inbound} → ${solo && caso?.estado === "ABIERTO" ? "CANCELADO (prueba)" : "se deja"}`);
    if (solo && caso?.estado === "ABIERTO") {
      writes.push(() => prisma.$transaction([
        prisma.caso.updateMany({ where: { id: casoId, estado: "ABIERTO" }, data: { estado: "CANCELADO", closedAt: new Date() } }),
        prisma.casoEvento.create({ data: { casoId, tipo: "transicion", actor: "system:limpieza-prueba", payload: { de: "ABIERTO", a: "CANCELADO", motivo: "prueba de Juan 19-nov" } } }),
      ]));
    }
  }

  console.log((APPLY ? "APLICANDO\n" : "EN SECO (nada escrito; --apply para ejecutar)\n") + plan.join("\n"));
  if (APPLY) for (const w of writes) await w();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

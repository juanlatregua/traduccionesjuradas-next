// lib/caso/resolver-db.ts — Acceso a BD del resolver: carga candidatos, decide con
// lib/caso/resolver.ts y crea/adjunta, todo en SU PROPIA transacción.
//
// Concurrencia: pg_advisory_xact_lock sobre TODAS las claves (e:, p: y anclas),
// ordenadas para que dos peticiones con claves cruzadas no se interbloqueen. Se
// eligió advisory lock y no SELECT … FOR UPDATE porque la clave que importa es la
// que AÚN no tiene caso (no hay fila que bloquear) y no pide tabla de claves; se
// libera sola al cerrar la transacción. Espacio propio (hashtext('caso'), dos
// enteros) para no chocar con el lock de un solo entero de lib/verifactu/records.ts.
// Una colisión de hashtext solo serializa de más, nunca une casos.
//
// F1: nadie lo llama todavía (los enganches son F2).

import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { identidadDe, aliasDesdeEnv, telefonosIntermediario, esAgencia, identityKeyDe, type Identidad } from "@/lib/caso/identidad";
import { esCasoEstado } from "@/lib/caso/estados";
import { decidirCaso, normPar, type CasoCandidato, type Decision, type Docs } from "@/lib/caso/resolver";

export type Anclas = {
  casoId?: string | null;
  quoteId?: string | null;
  lprRef?: string | null;
  orderId?: string | null;
  sessionToken?: string | null;
  expedienteRef?: string | null;
  inboundId?: string | null;
};

export type ResolverInput = {
  entrada: string;
  contacto: { email?: string | null; phone?: string | null; nombre?: string | null };
  pares?: string[];
  docs?: Partial<Docs>;
  anclas?: Anclas;
  customerId?: string | null;
  soloAdjuntar?: boolean; // email/WhatsApp entrante: une, nunca crea
  actor: string;
  dryRun?: boolean;
};

export type ResolverResultado = { casoId: string | null; creado: boolean; decision: Decision };

const DAY = 864e5;
const CERRADOS_VISIBLES_DIAS = 60;

export function nuevaRefCaso(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `CASO-${out}`;
}

export function clavesDeLock(id: Identidad, a: Anclas = {}): string[] {
  const out = new Set<string>(id.keys);
  if (a.quoteId) out.add(`q:${a.quoteId}`);
  if (a.lprRef) out.add(`l:${a.lprRef}`);
  if (a.orderId) out.add(`o:${a.orderId}`);
  if (a.sessionToken) out.add(`s:${a.sessionToken}`);
  if (a.expedienteRef) out.add(`x:${a.expedienteRef}`);
  if (a.inboundId) out.add(`i:${a.inboundId}`);
  return [...out].sort();
}

function anclaPrincipal(a: Anclas): string {
  return a.quoteId || a.lprRef || a.orderId || a.sessionToken || a.expedienteRef || a.inboundId || randomBytes(6).toString("hex");
}

async function casosPorAncla(tx: Prisma.TransactionClient, a: Anclas): Promise<string[]> {
  const ids = new Set<string>();
  const add = (x: { casoId: string | null } | null) => x?.casoId && ids.add(x.casoId);
  if (a.casoId) ids.add(a.casoId);
  if (a.quoteId) add(await tx.quote.findUnique({ where: { id: a.quoteId }, select: { casoId: true } }));
  if (a.lprRef) add(await tx.lavoriPriceRequest.findUnique({ where: { ref: a.lprRef }, select: { casoId: true } }));
  if (a.orderId) add(await tx.order.findUnique({ where: { id: a.orderId }, select: { casoId: true } }));
  if (a.inboundId) add(await tx.inboundEmail.findUnique({ where: { id: a.inboundId }, select: { casoId: true } }));
  if (a.sessionToken)
    add(await tx.documentAnalysis.findFirst({ where: { sessionToken: a.sessionToken, casoId: { not: null } }, select: { casoId: true } }));
  if (a.expedienteRef) {
    add(await tx.quote.findFirst({ where: { expedienteRef: a.expedienteRef, casoId: { not: null } }, select: { casoId: true } }));
    add(await tx.lavoriPriceRequest.findFirst({ where: { expedienteRef: a.expedienteRef, casoId: { not: null } }, select: { casoId: true } }));
  }
  return [...ids];
}

export async function resolverCaso(input: ResolverInput): Promise<ResolverResultado> {
  const alias = aliasDesdeEnv();
  const propios = [process.env.EMAIL_FROM, process.env.ADMIN_EMAIL];
  const anclas = input.anclas || {};
  const docs: Docs = { hashes: input.docs?.hashes || [], contentKeys: input.docs?.contentKeys || [] };
  const pares = (input.pares || []).map(normPar).filter(Boolean);
  const ahora = new Date();

  return prisma.$transaction(
    async (tx) => {
      const base = identidadDe(input.contacto, { alias, propios });
      for (const k of clavesDeLock(base, anclas)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('caso'), hashtext(${k}))`;
      }

      const vecinos = base.phone9
        ? await tx.caso.findMany({ where: { phone9: base.phone9 }, select: { email: true, phone9: true, nombre: true } })
        : [];
      const vetados = telefonosIntermediario([
        ...vecinos.map((v) => ({ email: v.email, phone: v.phone9, nombre: v.nombre })),
        { email: input.contacto.email, phone: input.contacto.phone, nombre: input.contacto.nombre },
      ]);
      const identidad = identidadDe(input.contacto, { alias, propios, telefonosVetados: vetados });

      const anclados = new Set(await casosPorAncla(tx, anclas));
      const emails = identidad.keys.filter((k) => k.startsWith("e:")).map((k) => k.slice(2));
      const phones = identidad.keys.filter((k) => k.startsWith("p:")).map((k) => k.slice(2));
      const porDoc = new Set<string>();
      if (docs.hashes.length) {
        for (const d of await tx.documentAnalysis.findMany({ where: { fileHash: { in: docs.hashes }, casoId: { not: null } }, select: { casoId: true } }))
          porDoc.add(d.casoId!);
      }
      if (docs.contentKeys.length) {
        for (const l of await tx.lavoriPriceRequest.findMany({ where: { contentKey: { in: docs.contentKeys }, casoId: { not: null } }, select: { casoId: true } }))
          porDoc.add(l.casoId!);
      }
      const desde = new Date(ahora.getTime() - CERRADOS_VISIBLES_DIAS * DAY);
      const casos = await tx.caso.findMany({
        where: {
          OR: [
            { id: { in: [...anclados, ...porDoc] } },
            ...(emails.length || phones.length
              ? [{ AND: [{ OR: [{ email: { in: emails } }, { phone9: { in: phones } }] }, { OR: [{ estado: "ABIERTO" }, { lastActivityAt: { gte: desde } }] }] }]
              : []),
          ],
        },
        take: 50,
        orderBy: { lastActivityAt: "desc" },
      });
      const ids = casos.map((c) => c.id);
      const hashes = ids.length
        ? await tx.documentAnalysis.findMany({ where: { casoId: { in: ids }, fileHash: { not: null } }, select: { casoId: true, fileHash: true } })
        : [];
      const keys = ids.length
        ? await tx.lavoriPriceRequest.findMany({ where: { casoId: { in: ids }, contentKey: { not: null } }, select: { casoId: true, contentKey: true } })
        : [];
      const candidatos: CasoCandidato[] = casos
        .filter((c) => esCasoEstado(c.estado))
        .map((c) => ({
          id: c.id,
          estado: c.estado as CasoCandidato["estado"],
          identidad: identidadDe({ email: c.email, phone: c.phone9 }, { alias, propios, telefonosVetados: vetados }),
          pares: c.pares,
          docs: {
            hashes: hashes.filter((h) => h.casoId === c.id).map((h) => h.fileHash!),
            contentKeys: keys.filter((k) => k.casoId === c.id).map((k) => k.contentKey!),
          },
          esAgencia: c.esAgencia,
          lastActivityAt: c.lastActivityAt,
          porAncla: anclados.has(c.id),
        }));

      const customer = input.customerId
        ? await tx.customer.findUnique({ where: { id: input.customerId }, select: { isBusiness: true, creditEnabled: true, billingCycle: true } })
        : null;
      const agencia = customer ? esAgencia(customer) : false;
      const decision = decidirCaso({ entrada: input.entrada, identidad, pares, docs, esAgencia: agencia, ahora }, candidatos);

      if (input.dryRun) return { casoId: decision.casoId ?? null, creado: false, decision };

      if (decision.accion === "adjuntar" && decision.casoId) {
        const actual = casos.find((c) => c.id === decision.casoId);
        await tx.caso.update({
          where: { id: decision.casoId },
          data: {
            lastActivityAt: ahora,
            pares: [...new Set([...(actual?.pares || []), ...pares])],
            ...(actual && !actual.email && identidad.email ? { email: identidad.email } : {}),
            ...(actual && !actual.phone9 && identidad.phone9 ? { phone9: identidad.phone9 } : {}),
          },
        });
        await tx.casoEvento.create({
          data: { casoId: decision.casoId, tipo: "adjuntado", actor: input.actor, payload: { entrada: input.entrada, regla: decision.regla, yaEncargado: !!decision.yaEncargado } },
        });
        return { casoId: decision.casoId, creado: false, decision };
      }

      if (input.soloAdjuntar) return { casoId: null, creado: false, decision };

      const caso = await tx.caso.create({
        data: {
          ref: nuevaRefCaso(),
          identityKey: identityKeyDe(identidad, anclaPrincipal(anclas)),
          email: identidad.email,
          phone9: identidad.phone9,
          nombre: input.contacto.nombre?.trim() || null,
          pares,
          origen: input.entrada,
          esAgencia: agencia,
          dudoso: decision.accion === "dudoso",
          customerId: input.customerId || null,
          lastActivityAt: ahora,
          createdBy: input.actor,
        },
        select: { id: true },
      });
      await tx.casoEvento.create({
        data: { casoId: caso.id, tipo: "creado", actor: input.actor, payload: { entrada: input.entrada, regla: decision.regla, posibles: decision.posibles } },
      });
      if (decision.posibles.length) {
        await tx.casoEvento.create({ data: { casoId: caso.id, tipo: "posible", actor: input.actor, payload: { con: decision.posibles, regla: decision.regla } } });
      }
      return { casoId: caso.id, creado: true, decision };
    },
    { timeout: 15_000 }
  );
}

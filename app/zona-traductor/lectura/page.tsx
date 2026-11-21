import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { lecturaConstructorOn } from "@/lib/lectura-constructor/flag.ts";
import { lecturaStore, regularizationOfSession } from "@/lib/lectura-constructor/server.ts";
import { viewOf } from "@/lib/lectura-constructor/api.ts";
import LecturaConstructor, { type LecturaSource } from "@/components/lectura/LecturaConstructor";
import { puertaV2On } from "@/lib/entrada/flag.ts";
import { EntradaResumen, EntradasPendientes } from "@/components/entrada/EntradasGestor";

async function casoRefs(ids: (string | null)[]): Promise<Record<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (list.length === 0) return {};
  const rows = await prisma.caso.findMany({ where: { id: { in: list } }, select: { id: true, ref: true } });
  return Object.fromEntries(rows.map((r) => [r.id, r.ref]));
}

export const metadata: Metadata = {
  title: "Zona traductor — Leer el lote",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v || "").trim().slice(0, 120);

export default async function LecturaPage({ searchParams }: { searchParams: { caso?: string; session?: string; quote?: string } }) {
  if (!lecturaConstructorOn()) notFound();
  await authZonaTraductorOrRedirect();

  const casoId = one(searchParams.caso);
  const sessionKey = one(searchParams.session);
  const quoteId = one(searchParams.quote);
  const source: LecturaSource | null = casoId
    ? { kind: "caso", casoId }
    : sessionKey
      ? { kind: "session", sessionKey }
      : quoteId
        ? { kind: "quote", quoteId }
        : null;
  if (!source) {
    if (!puertaV2On()) notFound();
    const entradas = await prisma.entrada.findMany({
      where: { estado: { in: ["confirmada", "leida", "sin_jurado"] }, updatedAt: { gte: new Date(Date.now() - 30 * 864e5) } },
      orderBy: [{ confirmedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      take: 100,
    });
    const refs = await casoRefs(entradas.flatMap((e) => [e.casoId, ...e.posibles, ...e.relacionados]));
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <EntradasPendientes entradas={entradas} refs={refs} />
        </div>
      </div>
    );
  }

  const where = casoId ? { casoId } : sessionKey ? { sessionKey } : { quoteId };
  const latest = await prisma.lecturaLote.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } });
  const data = latest ? await lecturaStore.get(latest.id) : null;

  const contact = casoId || sessionKey
    ? await prisma.documentAnalysis.findFirst({
        where: { ...(casoId ? { casoId } : { sessionToken: sessionKey }), clientEmail: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { clientName: true, clientEmail: true, clientPhone: true },
      })
    : null;
  const caso = casoId ? await prisma.caso.findUnique({ where: { id: casoId }, select: { ref: true, nombre: true, email: true, phone9: true } }) : null;
  const customer = {
    name: contact?.clientName || caso?.nombre || "",
    email: contact?.clientEmail || caso?.email || "",
    phone: contact?.clientPhone || caso?.phone9 || "",
  };
  const expedienteRef = sessionKey.startsWith("exp:") ? sessionKey.slice(4) : null;
  const regularization = data ? await regularizationOfSession(data.lote.sessionKey).catch(() => false) : false;
  const entradas = casoId && puertaV2On() ? await prisma.entrada.findMany({ where: { casoId }, orderBy: { createdAt: "asc" } }) : [];
  const entradaRefs = await casoRefs(entradas.flatMap((e) => [...e.posibles, ...e.relacionados]));

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <a href="/zona-traductor/presupuesto" className="text-sm text-cyan-400 hover:text-cyan-300">← Constructor</a>
          <h1 className="mt-2 text-2xl font-semibold text-white">Leer el lote{caso ? ` · ${caso.ref}` : expedienteRef ? ` · ${expedienteRef}` : ""}</h1>
          <p className="mt-1 text-sm text-slate-400">
            La lectura agrupa los archivos en documentos. Revisa, corrige y confirma: ninguna línea existe sin que una persona la confirme.
          </p>
        </header>
        <EntradaResumen entradas={entradas} refs={entradaRefs} />
        <LecturaConstructor source={source} initialView={data ? viewOf(data, { regularization }) : null} customer={customer} expedienteRef={expedienteRef} />
      </div>
    </div>
  );
}

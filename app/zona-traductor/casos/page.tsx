import type { Metadata } from "next";
import Link from "next/link";
import CasoAccionPaso from "@/components/CasoAccionPaso";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { siguientePaso, hrefCaso, type GrupoPaso } from "@/lib/caso/siguiente-paso";
import {
  QUOTE_PASO_SELECT,
  LPR_PASO_SELECT,
  PEDIDO_PASO_SELECT,
  nombreMiembro,
  baseUrlStaff,
  ESTADO_PILL,
  ESTADO_LABEL,
} from "@/lib/caso/vista";

export const metadata: Metadata = {
  title: "Zona traductor — Casos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FILTROS: { key: string; label: string; grupos: GrupoPaso[] | null }[] = [
  { key: "todos", label: "Todos", grupos: null },
  { key: "accion", label: "Necesitan acción", grupos: ["accion"] },
  { key: "jurado", label: "Esperando jurado", grupos: ["jurado"] },
  { key: "cliente", label: "Esperando cliente", grupos: ["cliente"] },
];

const GRUPO_CLS: Record<GrupoPaso, string> = {
  accion: "border-l-amber-400",
  jurado: "border-l-sky-500",
  cliente: "border-l-violet-500",
  en_curso: "border-l-emerald-500",
  cerrado: "border-l-slate-700",
};

const PAGABLE_DIAS = 14;

const fmt = (d: Date) => d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Props = { searchParams?: { f?: string; ver?: string } };

export default async function CasosBandejaPage({ searchParams }: Props) {
  await authZonaTraductorOrRedirect();
  const cerrados = searchParams?.ver === "cerrados";
  const filtro = FILTROS.find((f) => f.key === searchParams?.f) || FILTROS[0];
  const ahora = new Date();

  const casos = await prisma.caso.findMany({
    where: cerrados
      ? { estado: { notIn: ["ABIERTO", "EN_CURSO"] }, lastActivityAt: { gte: new Date(ahora.getTime() - 60 * 864e5) } }
      : {
          OR: [
            { estado: { in: ["ABIERTO", "EN_CURSO"] } },
            // Perdido por silencio pero con presupuesto aún pagable: se espera al cliente.
            {
              estado: "PERDIDO",
              quotes: { some: { deletedAt: null, supersededAt: null, expiredAt: null, status: { in: ["DRAFT", "SENT", "OPENED", "ACCEPTED"] }, sentAt: { gte: new Date(ahora.getTime() - PAGABLE_DIAS * 864e5) } } },
            },
          ],
        },
    orderBy: { lastActivityAt: "desc" },
    take: cerrados ? 100 : 300,
    select: {
      id: true,
      ref: true,
      estado: true,
      nombre: true,
      email: true,
      phone9: true,
      pares: true,
      dudoso: true,
      lastActivityAt: true,
      quotes: { select: QUOTE_PASO_SELECT },
      priceRequests: { select: LPR_PASO_SELECT },
      orders: { select: PEDIDO_PASO_SELECT },
      analyses: { where: { sessionToken: { not: null }, NOT: { sessionToken: { startsWith: "exp:" } } }, orderBy: { createdAt: "desc" }, take: 1, select: { sessionToken: true } },
    },
  });
  const ids = casos.map((c) => c.id);
  const posibles = ids.length
    ? new Set((await prisma.casoEvento.findMany({ where: { tipo: "posible", casoId: { in: ids } }, select: { casoId: true } })).map((e) => e.casoId))
    : new Set<string | null>();

  const baseUrl = baseUrlStaff();
  const filas = casos.map((c) => {
    const sesion = c.analyses[0]?.sessionToken;
    const paso = siguientePaso({
      casoId: c.id,
      estado: c.estado,
      quotes: c.quotes,
      lprs: c.priceRequests,
      pedidos: c.orders,
      baseUrl,
      ahora,
      sesion: sesion ?? null,
      nombreDe: nombreMiembro,
    });
    return { c, paso, posible: posibles.has(c.id) };
  }).filter((f) => cerrados || f.c.estado !== "PERDIDO" || f.paso.clave === "pagable_cerrado");
  const cuenta = (g: GrupoPaso[] | null) => (g ? filas.filter((f) => g.includes(f.paso.grupo)).length : filas.length);
  const visibles = (filtro.grupos ? filas.filter((f) => filtro.grupos!.includes(f.paso.grupo)) : filas).sort(
    (a, b) => Number(b.paso.grupo === "accion") - Number(a.paso.grupo === "accion")
  );
  const qs = (f: string) => `/zona-traductor/casos?${new URLSearchParams({ ...(f !== "todos" ? { f } : {}), ...(cerrados ? { ver: "cerrados" } : {}) })}`;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Casos</h1>
            <p className="mt-1 text-sm text-slate-400">
              Un caso = un cliente con un encargo: sus entradas, solicitudes a lavori, presupuestos y pedido juntos. Cada fila dice qué toca ahora.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={cerrados ? "/zona-traductor/casos" : "/zona-traductor/casos?ver=cerrados"}
              className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-300 hover:bg-slate-800"
            >
              {cerrados ? "Ver abiertos y en curso" : "Ver cerrados (60 días)"}
            </Link>
            <Link href="/zona-traductor/casos/discrepancias" className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-300 hover:bg-slate-800">
              Discrepancias
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-1 border-b border-slate-800 pb-2">
          {FILTROS.map((f) => (
            <Link
              key={f.key}
              href={qs(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                f.key === filtro.key ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {f.label}
              <span className="ml-2 text-xs text-slate-500">{cuenta(f.grupos)}</span>
            </Link>
          ))}
        </div>

        {visibles.length === 0 ? (
          <p className="mt-10 text-slate-500">Nada por aquí.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {visibles.map(({ c, paso, posible }) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 border-l-4 bg-slate-900/60 p-3 ${GRUPO_CLS[paso.grupo]}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={hrefCaso(c.id)} className="font-mono text-sm font-semibold text-cyan-300 hover:underline">
                      {c.ref}
                    </Link>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ESTADO_PILL[c.estado] || ESTADO_PILL.PERDIDO}`}>
                      {ESTADO_LABEL[c.estado] || c.estado}
                    </span>
                    {c.pares.map((p) => (
                      <span key={p} className="rounded bg-slate-700/60 px-2 py-0.5 text-xs font-semibold text-slate-200">
                        {p}
                      </span>
                    ))}
                    {c.dudoso && (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300" title="El resolver no supo a qué caso pertenece: revisar a mano">
                        dudoso
                      </span>
                    )}
                    {posible && (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-200" title="Puede ser el mismo encargo que otro caso (unir llegará en F3b)">
                        ¿mismo que otro?
                      </span>
                    )}
                    <span className="text-sm text-slate-200">{c.nombre || c.email || (c.phone9 ? `+34 ${c.phone9}` : "(sin identificar)")}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-300">{paso.titulo}</div>
                  <div className="text-xs text-slate-500">
                    {paso.detalle ? `${paso.detalle} · ` : ""}actividad {fmt(c.lastActivityAt)}
                  </div>
                </div>
                {paso.accion && <CasoAccionPaso {...paso.accion} compacto />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

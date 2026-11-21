import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HoyVista from "@/components/mesa/HoyVista";
import type { AgendaHoy } from "@/components/mesa/AgendaVista";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { mesaV2On } from "@/lib/mesa/flag";
import { cargarMesa } from "@/lib/mesa/datos";
import { accionesFueraDeLaPila, fueraDeLaPila, refsDeLaPila, relativo } from "@/lib/mesa/agenda";
import { buildVigia, type Vigia } from "@/lib/vigia";
import { vigiaMarkUrl } from "@/lib/vigia-mark";

export const metadata: Metadata = {
  title: "Zona traductor — Hoy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Si el vigía tarda más, Hoy sale sin la agenda (con enlace a /zona-traductor/vigia). */
const AGENDA_TOPE_MS = 8000;

const marca = (k: string | undefined, quoteId: string | null | undefined, a: "t" | "p") => {
  const url = k ? vigiaMarkUrl(k, quoteId, a) : null;
  return url ? url.replace(/^https?:\/\/[^/]+/, "") : null;
};

export default async function HoyPage() {
  if (!mesaV2On()) notFound();
  await authZonaTraductorOrRedirect();
  const ahora = new Date();
  let tope: ReturnType<typeof setTimeout> | undefined;
  const [mesa, vigia] = await Promise.all([
    cargarMesa(ahora),
    Promise.race([
      buildVigia(7).catch((e): Vigia | null => {
        console.error("[hoy] agenda del vigía", e);
        return null;
      }),
      new Promise<"tarda">((r) => (tope = setTimeout(() => r("tarda"), AGENDA_TOPE_MS))),
    ]),
  ]);
  clearTimeout(tope);
  let agenda: AgendaHoy | "tarda" | null = null;
  if (vigia === "tarda") {
    agenda = "tarda";
  } else if (vigia) {
    const refs = refsDeLaPila(mesa.yo);
    const a = vigia.agenda;
    agenda = {
      traducir: fueraDeLaPila(a.traducir, refs),
      seguir: fueraDeLaPila(a.seguir, refs),
      entregar: fueraDeLaPila(a.entregar, refs),
      sinFecha: fueraDeLaPila(a.sinFecha, refs),
      palabrasSemana: a.palabrasSemana,
      horasSemana: a.horasSemana,
      diasNecesarios: a.diasNecesarios,
      acciones: accionesFueraDeLaPila(vigia.acciones, refs).map((x) => ({
        que: x.que,
        href: relativo(x.link),
        estado: x.estado,
        extras: x.extras,
        botones: x.botones,
        tratado: marca(x.persona?.key, x.persona?.quoteId, "t"),
        posponer: marca(x.persona?.key, x.persona?.quoteId, "p"),
      })),
      ocultos: vigia.ocultos.length,
    };
  } else {
    mesa.avisos.push("No se ha podido leer la agenda del vigía: mira el email de las 8:00 o /zona-traductor/vigia.");
  }
  return <HoyVista mesa={mesa} ahora={ahora} agenda={agenda} />;
}

import Link from "next/link";
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CIUDADES, type Ciudad } from "@/src/data/ciudades";

export const metadata: Metadata = {
  title: "Traductor Jurado por Ciudades en España · Servicio Online · MAEC",
  description:
    "Traductor jurado oficial (MAEC) para toda España, 100% online. Encuentra la traducción jurada en tu ciudad: Madrid, Barcelona, Valencia, Sevilla, Málaga y más. Entrega en 24-48h, sin desplazamientos.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/traductor-jurado" },
};

// Solo las ciudades indexables (la cola consolidada queda fuera del hub).
const CIUDADES_HUB = CIUDADES.filter((c) => !c.noindex);

// Agrupadas por comunidad autónoma para estructura y enlazado contextual.
function porComunidad(ciudades: Ciudad[]): [string, Ciudad[]][] {
  const map = new Map<string, Ciudad[]>();
  for (const c of ciudades) {
    const arr = map.get(c.comunidad) || [];
    arr.push(c);
    map.set(c.comunidad, arr);
  }
  return [...map.entries()]
    .map(([com, arr]) => [com, arr.sort((a, b) => b.poblacion - a.poblacion)] as [string, Ciudad[]])
    .sort((a, b) => a[0].localeCompare(b[0], "es"));
}

export default function HubCiudades() {
  const grupos = porComunidad(CIUDADES_HUB);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-traductor-jurado-hub"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Traductor jurado por ciudades", url: "https://www.traduccionesjuradas.net/traductor-jurado" },
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Traductor jurado por ciudades", href: "/traductor-jurado" },
        ]}
      />

      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-bleu">
        Traductor jurado oficial · MAEC
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre">
        Traductor jurado por ciudades en España
      </h1>
      <p className="mt-3 max-w-2xl text-base text-sepia">
        Somos traductores jurados acreditados por el MAEC (nº 3850) y trabajamos{" "}
        <strong>100% online para toda España</strong>: envías tus documentos desde tu ciudad y
        recibes la traducción jurada con validez oficial en 24-48&nbsp;horas, sin desplazamientos.
        Elige tu ciudad para ver los trámites y documentos más frecuentes.
      </p>
      <div className="mt-5">
        <Link
          href="/presupuesto-instantaneo"
          className="rounded-lg bg-bleu px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bleu/90 transition-colors"
        >
          Pedir presupuesto instantáneo
        </Link>
      </div>

      {grupos.map(([comunidad, ciudades]) => (
        <section key={comunidad} className="mt-10">
          <h2 className="font-baskerville text-lg font-bold text-encre">{comunidad}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ciudades.map((c) => (
              <Link
                key={c.slug}
                href={`/traductor-jurado/${c.slug}`}
                className="flex items-center justify-between rounded-doc border border-cream bg-card px-4 py-3 shadow-paper hover:border-bleu hover:text-bleu transition-colors"
              >
                <span className="text-sm font-medium text-encre">Traductor jurado en {c.nombre}</span>
                {c.tieneConsulado && (
                  <span className="ml-2 shrink-0 rounded-full bg-bleu/10 px-2 py-0.5 text-[10px] font-semibold text-bleu">
                    Consulado FR
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-10 text-sm text-sepia">
        ¿No ves tu ciudad? El servicio es online para toda España —{" "}
        <Link href="/presupuesto-instantaneo" className="font-semibold text-bleu hover:underline">
          pide tu presupuesto
        </Link>{" "}
        igualmente.
      </p>
    </main>
  );
}

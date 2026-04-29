// Visible author byline with verifiable credential.
// E-E-A-T: shows real authority (MAEC nº 3850) above the fold of every blog post.

import Link from "next/link";

type Props = {
  date: string | Date;
  dateModified?: string | Date;
  readingTime?: number;
};

export function AuthorByline({ date, dateModified, readingTime }: Props) {
  const datePub = new Date(date);
  const dateMod = dateModified ? new Date(dateModified) : null;
  const showModified =
    dateMod && dateMod.getTime() > datePub.getTime() + 24 * 3600 * 1000;

  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-cream bg-card px-4 py-3 text-sm shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bleu/10 text-base font-semibold text-bleu">
        JS
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-encre">
          <Link
            href="/traductores-jurados"
            className="hover:text-bleu transition-colors"
          >
            Juan Silva Moreno
          </Link>
          <span className="ml-2 inline-flex items-center rounded-full bg-or/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-or-dark">
            ✓ MAEC nº 3850
          </span>
        </p>
        <p className="mt-0.5 text-xs text-graphite">
          Traductor-intérprete jurado de francés acreditado por el{" "}
          <a
            href="https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-bleu"
          >
            Ministerio de Asuntos Exteriores
          </a>
          .
        </p>
        <p className="mt-1 text-[11px] text-graphite">
          Publicado el{" "}
          {datePub.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {showModified && (
            <>
              {" · Actualizado el "}
              {dateMod!.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </>
          )}
          {readingTime && readingTime > 0 && (
            <> · {Math.max(1, Math.round(readingTime))} min de lectura</>
          )}
        </p>
      </div>
    </div>
  );
}

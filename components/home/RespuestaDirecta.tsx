import { LOCALE_INTL, type Locale } from "@/lib/i18n/locales";
import { MAEC_TRADUCTORES_URL, PORTADAS_UPDATED, RESPUESTA_DIRECTA } from "@/lib/i18n/respuesta-directa";

export default function RespuestaDirecta({ lang }: { lang: Exclude<Locale, "es"> }) {
  const t = RESPUESTA_DIRECTA[lang];
  const fecha = new Date(`${PORTADAS_UPDATED}T12:00:00Z`).toLocaleDateString(LOCALE_INTL[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="border-b border-cream bg-parchment py-8">
      <div className="mx-auto max-w-4xl px-4">
        <p className="text-base font-medium leading-relaxed text-encre">{t.lead}</p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-cream bg-card shadow-paper">
          <table className="w-full text-left text-sm text-sepia">
            <thead className="bg-cream text-encre">
              <tr>
                {t.head.map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r[0]} className="border-t border-cream">
                  <th scope="row" className="px-4 py-2 font-normal">
                    {r[0]}
                  </th>
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-encre">{r[1]}</td>
                  <td className="px-4 py-2">{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-sepia">
          <time dateTime={PORTADAS_UPDATED}>
            {t.updated} {fecha}
          </time>
          {" · "}
          <a href={MAEC_TRADUCTORES_URL} className="underline" rel="noopener">
            {t.source}
          </a>
        </p>
      </div>
    </section>
  );
}

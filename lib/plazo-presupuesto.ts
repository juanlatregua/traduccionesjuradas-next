export type PlazoLang = "es" | "fr" | "en" | "de" | "pt";

const T: Record<PlazoLang, { hora: string; hoy: string; manana: string; lunes: string; breve: string }> = {
  es: { hora: "en 1 hora o menos", hoy: "hoy a partir de las 8:00", manana: "mañana a partir de las 8:00", lunes: "el lunes a partir de las 8:00", breve: "en breve" },
  fr: { hora: "en 1 heure ou moins", hoy: "aujourd'hui à partir de 8 h", manana: "demain à partir de 8 h", lunes: "lundi à partir de 8 h", breve: "sous peu" },
  en: { hora: "within 1 hour", hoy: "today from 8:00 am (Spain time)", manana: "tomorrow from 8:00 am (Spain time)", lunes: "on Monday from 8:00 am (Spain time)", breve: "shortly" },
  de: { hora: "innerhalb einer Stunde", hoy: "heute ab 8:00 Uhr (spanische Zeit)", manana: "morgen ab 8:00 Uhr (spanische Zeit)", lunes: "am Montag ab 8:00 Uhr (spanische Zeit)", breve: "in Kürze" },
  pt: { hora: "em 1 hora ou menos", hoy: "hoje a partir das 8:00 (hora de Espanha)", manana: "amanhã a partir das 8:00 (hora de Espanha)", lunes: "na segunda-feira a partir das 8:00 (hora de Espanha)", breve: "em breve" },
};

export const EN_BREVE: Record<PlazoLang, string> = { es: T.es.breve, fr: T.fr.breve, en: T.en.breve, de: T.de.breve, pt: T.pt.breve };

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function madrid(now: Date): { dow: number; hour: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dow: DOW[get("weekday")] ?? 0, hour: Number(get("hour")) % 24 };
}

export function plazoPresupuesto(lang: PlazoLang, isFr: boolean, now: Date): string {
  const t = T[lang] ?? T.es;
  if (!isFr) return t.breve;
  const { dow, hour } = madrid(now);
  const laborable = dow >= 1 && dow <= 5;
  if (laborable && hour >= 8 && hour < 20) return t.hora;
  if (laborable && hour < 8) return t.hoy;
  if (dow === 5 || dow === 6) return t.lunes;
  return t.manana;
}

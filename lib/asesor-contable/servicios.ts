// lib/asesor-contable/servicios.ts — Qué servicios tenemos contratados y cuánto
// cuestan al año, a partir de los gastos de los últimos 12 meses. PURO (sin BD).
// Fuera: traductores, nómina y Seguridad Social (no son servicios que se puedan
// cambiar de proveedor).

export type ServicioExpense = {
  date: Date;
  supplier: string | null;
  concept: string;
  category: string | null;
  totalCents: number;
  isAccrual: boolean;
  collaboratorId?: string | null;
};

export type Servicio = {
  proveedor: string;
  tipo: string;
  frecuencia: "mensual" | "puntual";
  apuntes: number;
  ultimo_cargo: string; // YYYY-MM-DD
  ultimo_importe_eur: number;
  total_12_meses_eur: number;
  anual_estimado_eur: number;
  meses_a_cero: number; // mensualidades registradas a 0 €: gasto sin completar
  nota: string | null;
};

const DAY_MS = 86_400_000;
const FUERA_CATEGORIA = new Set(["colaborador", "nómina", "nomina-especie", "seguridad social", "seguro médico"]);
const FUERA_TEXTO = /traducci[oó]n jurada|traducciones, s\.l|seguridad social|\btgss\b/i;

const TIPOS: [RegExp, string][] = [
  [/vercel|cdmon|piensa|namesilo|cloudflare/i, "Hosting y dominios"],
  [/anthropic|openai/i, "IA"],
  [/microsoft|adobe|zoom|twilio/i, "Software"],
  [/orange|digi/i, "Telefonía"],
  [/laborlex/i, "Gestoría"],
  [/stripe/i, "Comisiones de cobro"],
  [/orsa/i, "Mensajería"],
];

// Comprobado el 30-oct-2026 con dig: web en Vercel, DNS en Cloudflare, correo en Microsoft 365.
const NOTAS: [RegExp, string][] = [
  [/cdmon/i, "La web está en Vercel, el DNS en Cloudflare y el correo en Microsoft 365: revisar si este hosting sigue haciendo falta."],
];

const eur = (cents: number) => Math.round(cents) / 100;
const dia = (d: Date) => d.toISOString().slice(0, 10);

export function serviciosContratados(gastos: ServicioExpense[], now: Date): Servicio[] {
  const desde = now.getTime() - 365 * DAY_MS;
  const grupos = new Map<string, ServicioExpense[]>();
  for (const g of gastos) {
    if (g.isAccrual || g.collaboratorId || !g.supplier?.trim()) continue;
    if (FUERA_CATEGORIA.has(g.category ?? "") || FUERA_TEXTO.test(`${g.supplier} ${g.concept}`)) continue;
    if (g.date.getTime() < desde || g.date.getTime() > now.getTime()) continue;
    const k = g.supplier.trim();
    grupos.set(k, [...(grupos.get(k) ?? []), g]);
  }

  return [...grupos.entries()]
    .map(([proveedor, xs]) => {
      const orden = [...xs].sort((a, b) => a.date.getTime() - b.date.getTime());
      const conImporte = orden.filter((x) => x.totalCents > 0);
      const porMes = new Map<string, number>();
      for (const x of conImporte) porMes.set(dia(x.date).slice(0, 7), (porMes.get(dia(x.date).slice(0, 7)) ?? 0) + x.totalCents);
      const total = orden.reduce((s, x) => s + x.totalCents, 0);
      const mensual = porMes.size >= 6;
      const ultimos = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-3).map(([, c]) => c);
      const anual = mensual ? (ultimos.reduce((s, c) => s + c, 0) / ultimos.length) * 12 : total;
      const ultimo = conImporte.at(-1);
      const texto = `${proveedor} ${orden.at(-1)?.concept ?? ""}`;
      return {
        proveedor,
        tipo: TIPOS.find(([re]) => re.test(proveedor))?.[1] ?? "Otros",
        frecuencia: mensual ? ("mensual" as const) : ("puntual" as const),
        apuntes: orden.length,
        ultimo_cargo: ultimo ? dia(ultimo.date) : dia(orden.at(-1)!.date),
        ultimo_importe_eur: eur(ultimo?.totalCents ?? 0),
        total_12_meses_eur: eur(total),
        anual_estimado_eur: eur(anual),
        meses_a_cero: orden.filter((x) => x.totalCents === 0).length,
        nota: NOTAS.find(([re]) => re.test(texto))?.[1] ?? null,
      };
    })
    .sort((a, b) => b.anual_estimado_eur - a.anual_estimado_eur);
}

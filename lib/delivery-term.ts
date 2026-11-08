import { addBusinessDays } from "./delivery-date.ts";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MADRID = "Europe/Madrid";
const STALE_DAYS = 60;

function madridYmd(d: Date): [number, number, number] {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: MADRID, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-")
    .map(Number);
  return [y, m - 1, day];
}

function madridEvening(y: number, m: number, d: number): Date {
  const hourAt16Utc = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: MADRID, hour: "2-digit", hour12: false }).format(new Date(Date.UTC(y, m, d, 16)))
  );
  return new Date(Date.UTC(y, m, d, 18 - (hourAt16Utc - 16)));
}

/** Quote.deliveryTerm → fecha límite del pedido. «N-M días hábiles» (usa M) o «martes 10 de noviembre» (18:00 Madrid); otro texto → null. */
export function parseDeliveryTerm(term: string | null | undefined, paidAt: Date): Date | null {
  const text = String(term || "").trim().toLowerCase();
  if (!text) return null;

  const business = text.match(/(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s+d[ií]as?\s+h[aá]b(?:iles|il)/);
  if (business) {
    const days = Number(business[2] ?? business[1]);
    return days > 0 ? addBusinessDays(paidAt, days) : null;
  }

  const calendar = text.match(new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTHS.join("|")})`));
  if (!calendar) return null;
  const day = Number(calendar[1]);
  const month = MONTHS.indexOf(calendar[2]);
  const [py, pm, pd] = madridYmd(paidAt);
  for (let year = py; year <= py + 4; year++) {
    const probe = new Date(Date.UTC(year, month, day));
    if (probe.getUTCMonth() !== month || probe.getUTCDate() !== day) continue;
    if (Date.UTC(year, month, day) < Date.UTC(py, pm, pd) - STALE_DAYS * 86_400_000) continue;
    return madridEvening(year, month, day);
  }
  return null;
}

// lib/tax-close-store.ts — Fuente ÚNICA de la fecha de cierre del 303 (BD).
// Primera fecha facturable = fin del último trimestre presentado (TaxPeriodClose).
// Sin env ni caché: la env convertía "Reabrir" en un no-op silencioso y la caché
// por instancia abría una ventana de 60s para retro-fechar en un periodo cerrado.
// El fallback solo aplica con la tabla VACÍA (bootstrap/dev); en prod se siembra
// la fila del último trimestre presentado (2026-T1 en el despliegue inicial).

import { prisma } from "@/lib/prisma";
import { taxPeriodCloseDate } from "@/lib/tax-close";

const BOOTSTRAP_303_CLOSE = new Date("2026-04-01T00:00:00.000Z"); // fin de 2026-T1

export async function getLast303Close(): Promise<Date> {
  const closes = await prisma.taxPeriodClose.findMany({ select: { period: true } });
  let value: Date | null = null;
  for (const c of closes) {
    const end = taxPeriodCloseDate(c.period);
    if (end && (!value || end > value)) value = end;
  }
  return value ?? BOOTSTRAP_303_CLOSE;
}

// Emisión con fecha explícita dentro de un trimestre ya presentado → error claro.
// Vive aquí para que TODOS los caminos de emisión (ruta /issue, pedido individual,
// lote, lazy_pdf) hereden el gate desde el chokepoint de lib/client-invoice.
export async function assertNotInClosedPeriod(issuedAt: Date): Promise<void> {
  const close = await getLast303Close();
  if (issuedAt < close) {
    throw new Error(
      `La fecha de emisión ${issuedAt.toISOString().slice(0, 10)} cae en un trimestre ya presentado (303 cerrado hasta ${close.toISOString().slice(0, 10)}): usa la fecha de hoy o reabre el trimestre en Contabilidad.`
    );
  }
}

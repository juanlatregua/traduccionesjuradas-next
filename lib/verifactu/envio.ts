// lib/verifactu/envio.ts — decisiones PURAS del envío a la AEAT (sin Prisma).

export const AEAT_CLOCK_MARGIN_SECONDS = 240;
const LATE_SAFETY_SECONDS = 20;
export const IMMEDIATE_TIMEOUT_MS = 8_000;

/** Segundos que faltan para poder volver a enviar (TiempoEsperaEnvio del último envío). */
export function remainingWaitSeconds(lastSentAt: Date | null, tiempoEspera: unknown, now: Date, defaultSeconds = 60): number {
  if (!lastSentAt) return 0;
  const t = tiempoEspera === null || tiempoEspera === undefined || tiempoEspera === "" ? NaN : Number(tiempoEspera);
  const wait = Number.isFinite(t) && t >= 0 ? t : defaultSeconds;
  return Math.max(0, Math.ceil((lastSentAt.getTime() + wait * 1000 - now.getTime()) / 1000));
}

/** El registro llegaría a la AEAT fuera del margen de FechaHoraHusoGenRegistro (error 2004). */
export function isLateRecord(generatedAt: Date, now: Date): boolean {
  return (now.getTime() - generatedAt.getTime()) / 1000 > AEAT_CLOCK_MARGIN_SECONDS - LATE_SAFETY_SECONDS;
}

/** Un envío con algún registro tardío se declara con Incidencia=S en la cabecera. */
export function batchHasIncidencia(generatedAts: Date[], now: Date): boolean {
  return generatedAts.some((g) => isLateRecord(g, now));
}

/** El envío inmediato tras emitir solo se intenta con proveedor y sin espera pendiente; si no, lo envía el cron. */
export function shouldSendNow(providerActive: boolean, waitSeconds: number): boolean {
  return providerActive && waitSeconds <= 0;
}

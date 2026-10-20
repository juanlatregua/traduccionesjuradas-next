// lib/verifactu/envio.ts — decisiones PURAS del envío a la AEAT (sin Prisma).

export const IMMEDIATE_TIMEOUT_MS = 8_000;

/** Segundos que faltan para poder volver a enviar (TiempoEsperaEnvio del último envío). */
export function remainingWaitSeconds(lastSentAt: Date | null, tiempoEspera: unknown, now: Date, defaultSeconds = 60): number {
  if (!lastSentAt) return 0;
  const t = tiempoEspera === null || tiempoEspera === undefined || tiempoEspera === "" ? NaN : Number(tiempoEspera);
  const wait = Number.isFinite(t) && t >= 0 ? t : defaultSeconds;
  return Math.max(0, Math.ceil((lastSentAt.getTime() + wait * 1000 - now.getTime()) / 1000));
}

/** Fallo real de comunicación con la AEAT (red, timeout, SOAP Fault, 5xx): único caso en que un registro se declara con Incidencia=S. */
export function isIncidentError(message: string): boolean {
  if (/Codigo\[4\d{3}\]/i.test(message)) return false;
  return /timeout|soap fault|econn|enotfound|eai_again|etimedout|epipe|socket hang up|HTTP 5\d\d/i.test(message);
}

/** La cabecera Incidencia es por envío: longitud del tramo inicial de registros con el mismo valor, para no mezclar. */
export function leadingRunLength(flags: boolean[]): number {
  let n = 0;
  while (n < flags.length && flags[n] === flags[0]) n++;
  return n;
}

/** El envío inmediato tras emitir solo se intenta con proveedor y sin espera pendiente; si no, lo envía el cron. */
export function shouldSendNow(providerActive: boolean, waitSeconds: number): boolean {
  return providerActive && waitSeconds <= 0;
}

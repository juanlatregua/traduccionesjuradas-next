// SENT si el envío no lanzó excepción, FAILED si lanzó. Graph no devuelve id de
// mensaje (sendQuoteEmail.providerId es siempre null): nunca deducir el estado de él.
export function emailSendStatus(error: string | null): "SENT" | "FAILED" {
  return error === null ? "SENT" : "FAILED";
}

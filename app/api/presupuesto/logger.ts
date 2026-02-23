export type PresupuestoLog = {
  status: "ok" | "error";
  error?: string;
  toInternal?: string;
  toClient?: string;
  orderReference?: string | null;
  hasAttachments: boolean;
  route: string;
  userEmail?: string;
  timestamp: string;
};

export function logPresupuesto(data: PresupuestoLog) {
  // Simple console log structured; in prod you can wire to a logging service
  console.info("[PRESUPUESTO_LOG]", JSON.stringify(data));
}

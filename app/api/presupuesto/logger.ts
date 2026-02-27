export type PresupuestoLog = {
  status: "ok" | "error";
  error?: string;
  toInternal?: string;
  toClient?: string;
  referencia?: string;
  orderReference?: string;
  quoteId?: string;
  route: string;
  userEmail?: string;
  timestamp: string;
};

export function logPresupuesto(data: PresupuestoLog) {
  console.info("[PRESUPUESTO_LOG]", JSON.stringify(data));
}

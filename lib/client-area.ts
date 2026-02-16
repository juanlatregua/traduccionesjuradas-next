export type PaymentState = "pendiente" | "pagado";
export type DeliveryState = "presupuesto" | "en_proceso" | "traducido";

export type OrderConcept = {
  concept: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OrderHistoryEntry = {
  date: string;
  text: string;
};

export type ClientOrder = {
  reference: string;
  createdAt: string;
  langPair: string;
  presupuestoUrl: string;
  paymentUrl: string;
  bizumUrl: string;
  paypalUrl: string;
  bankTransferUrl: string;
  paymentState: PaymentState;
  deliveryState: DeliveryState;
  translatedFileUrl?: string;
  concepts: OrderConcept[];
  total: number;
  history: OrderHistoryEntry[];
};

export const CLIENT_ORDERS: ClientOrder[] = [
  {
    reference: "26_001",
    createdAt: "2026-02-16",
    langPair: "Frances -> Espanol",
    presupuestoUrl: "/presupuesto?ref=26_001",
    paymentUrl: "/pago?ref=26_001&method=card",
    bizumUrl: "/pago?ref=26_001&method=bizum",
    paypalUrl: "/pago?ref=26_001&method=paypal",
    bankTransferUrl: "/pago?ref=26_001&method=transfer",
    paymentState: "pendiente",
    deliveryState: "en_proceso",
    concepts: [
      { concept: "Certificado de nacimiento (1 hoja)", quantity: 1, unitPrice: 40, total: 40 },
      { concept: "Apostilla (1 hoja)", quantity: 1, unitPrice: 10, total: 10 },
    ],
    total: 50,
    history: [
      { date: "2026-02-16 09:15", text: "Presupuesto generado con referencia 26_001." },
      { date: "2026-02-16 09:20", text: "Pedido confirmado. Pendiente de pago." },
      { date: "2026-02-16 10:30", text: "Traduccion en proceso." },
    ],
  },
  {
    reference: "26_002",
    createdAt: "2026-02-15",
    langPair: "Espanol -> Frances",
    presupuestoUrl: "/presupuesto?ref=26_002",
    paymentUrl: "/pago?ref=26_002&method=card",
    bizumUrl: "/pago?ref=26_002&method=bizum",
    paypalUrl: "/pago?ref=26_002&method=paypal",
    bankTransferUrl: "/pago?ref=26_002&method=transfer",
    paymentState: "pagado",
    deliveryState: "traducido",
    translatedFileUrl: "/pago/exito?ref=26_002",
    concepts: [
      { concept: "Titulo universitario apostillado", quantity: 1, unitPrice: 45, total: 45 },
      { concept: "Expediente academico (2 paginas)", quantity: 2, unitPrice: 35, total: 70 },
    ],
    total: 115,
    history: [
      { date: "2026-02-15 08:45", text: "Presupuesto generado con referencia 26_002." },
      { date: "2026-02-15 09:05", text: "Pago recibido por tarjeta." },
      { date: "2026-02-15 12:40", text: "Traduccion finalizada y entregada en PDF." },
    ],
  },
];

export function getPaymentStateLabel(state: PaymentState) {
  return state === "pagado" ? "Pagado" : "Pendiente de pago";
}

export function getDeliveryStateLabel(state: DeliveryState) {
  if (state === "presupuesto") return "Presupuesto emitido";
  if (state === "en_proceso") return "En proceso";
  return "Traducido";
}

// lib/order-closure.ts — Qué es un pedido CERRADO. Una sola definición.
//
// El problema (19-sep-2026): la pantalla de Pedidos decía "51 activos" cuando 47
// eran trabajo terminado y cobrado. "Activo" no significaba "en marcha": era
// `!isArchived`, y archivar es un evento manual que hay que disparar a mano.
// Resultado: nada salía nunca de la lista, y la cifra grande de la pantalla era
// "cuántos pedidos he tenido en la vida" disfrazada de "cuántos tengo abiertos".
// El cierre financiero, que existe desde hace meses, se había usado CERO veces.
//
// Definición de Juan (19-sep-2026, literal): «cerrado es cuando el cliente ha
// recibido su traducción, han pasado 24 h y no solicita revisión, y hemos pagado
// al proveedor o lo dejamos pendiente para final de mes porque factura así».
//
// Dos decisiones que se derivan de esa frase y conviene dejar escritas:
//
//  · NO exige cobro. Un pedido a crédito (factura emitida con vencimiento) se
//    cierra al entregarse aunque el dinero llegue a 30 días. El trabajo está
//    hecho; lo que falta es un COBRO, y los cobros se persiguen desde Facturas,
//    no desde el tablero de pedidos. Mezclarlos es lo que tenía la lista llena.
//
//  · "No solicita revisión" no existe como dato: el cliente no tiene botón para
//    pedirla. Lo que sí existe es la huella de que hubo que corregir la entrega
//    (`delivery.corrected`). Así que se mide al revés y del lado seguro: 24 h
//    desde que el cliente recibió la traducción SIN que haya habido corrección.
//    Si aparece una corrección, el reloj vuelve a empezar desde ella.

export type SupplierInvoiceState = "NONE" | "EXPECTED" | "RECEIVED" | "BOOKED" | "PAID" | "UNKNOWN";
export type SupplierBilling = "PER_ORDER" | "MONTHLY_BATCH" | "UNKNOWN";

export const REVISION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ClosureInput = {
  /** Cuándo recibió el cliente su traducción (notification.delivery_ready.sent). */
  deliveredToClientAt: Date | null;
  /** Última corrección de la entrega, si la hubo (delivery.corrected). */
  correctedAt: Date | null;
  /** ¿Hay colaborador externo en este pedido? Si no, el proveedor no bloquea. */
  hasCollaborator: boolean;
  supplierInvoiceStatus: SupplierInvoiceState;
  supplierBillingMode: SupplierBilling;
  now?: Date;
};

export type ClosureVerdict = {
  closed: boolean;
  /** Por qué sigue abierto, en una frase para la pantalla. Vacío si está cerrado. */
  pendiente: string;
  /** Cuándo se cerraría solo, si solo falta que pase el tiempo. */
  cierraEl: Date | null;
};

/** El proveedor no bloquea el cierre si ya está pagado, si no hay colaborador, o
 *  si factura a fin de mes (su cobro va por el lote mensual, no por el pedido). */
export function supplierBlocksClosure(input: Pick<ClosureInput, "hasCollaborator" | "supplierInvoiceStatus" | "supplierBillingMode">): boolean {
  if (!input.hasCollaborator) return false;
  if (input.supplierBillingMode === "MONTHLY_BATCH") return false;
  return input.supplierInvoiceStatus !== "PAID";
}

export function orderClosure(input: ClosureInput): ClosureVerdict {
  const now = input.now ?? new Date();

  if (!input.deliveredToClientAt) {
    return { closed: false, pendiente: "el cliente todavía no ha recibido la traducción", cierraEl: null };
  }

  // El reloj de las 24 h cuenta desde la ÚLTIMA vez que el cliente recibió algo:
  // si hubo corrección, desde la corrección.
  const desde =
    input.correctedAt && input.correctedAt > input.deliveredToClientAt ? input.correctedAt : input.deliveredToClientAt;
  const cierraEl = new Date(desde.getTime() + REVISION_WINDOW_MS);

  if (now < cierraEl) {
    const horas = Math.max(1, Math.ceil((cierraEl.getTime() - now.getTime()) / 3_600_000));
    return {
      closed: false,
      pendiente:
        input.correctedAt && input.correctedAt > input.deliveredToClientAt
          ? `entrega corregida: faltan ${horas} h de margen de revisión`
          : `faltan ${horas} h del margen de revisión`,
      cierraEl,
    };
  }

  if (supplierBlocksClosure(input)) {
    return { closed: false, pendiente: "falta pagar la factura del colaborador", cierraEl: null };
  }

  return { closed: true, pendiente: "", cierraEl };
}

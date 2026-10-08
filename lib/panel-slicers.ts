// Segmentadores (slicers) de Pedidos: el mismo criterio de segmento para las filas del Panel y para los pedidos de la tabla. Puro.
import { channelLabel, originLabel, pairLabel, paymentLabel, translatorLabel, type Dimension, type OrderRow, type PanelData } from "./panel-metrics.ts";

export type SlicerKey = "lengua" | "par" | "trad" | "cliente" | "canal" | "via";

export const SLICERS: { key: SlicerKey; param: string; label: string; dimension: Dimension }[] = [
  { key: "lengua", param: "f_lengua", label: "Lengua", dimension: "lengua_origen" },
  { key: "par", param: "f_par", label: "Par", dimension: "par" },
  { key: "trad", param: "f_trad", label: "Traductor", dimension: "traductor" },
  { key: "cliente", param: "f_cliente", label: "Cliente", dimension: "cliente" },
  { key: "canal", param: "f_canal", label: "Canal", dimension: "canal" },
  { key: "via", param: "f_via", label: "Vía de pago", dimension: "via_pago" },
];
export const SLICER_PARAMS = SLICERS.map((s) => s.param);

export type Slicers = Partial<Record<SlicerKey, string[]>>;
export type Segment = Record<SlicerKey, string>;
export type SegmentInput = Pick<OrderRow, "langPair" | "assignedTo" | "client" | "paymentMethod" | "channel">;

export function getAcquisitionSource(order: { events?: { type: string; payload?: unknown }[] }): "WHATSAPP" | "WEB" {
  const events = order.events || [];
  if (events.some((e) => e.type === "wa.lead_received")) return "WHATSAPP";
  const acquisitionEvent = events.find((e) => e.type === "order.acquisition");
  const source = String((acquisitionEvent?.payload as any)?.source || "").toUpperCase();
  return source === "WHATSAPP" ? "WHATSAPP" : "WEB";
}

/** Entrada de segmento desde un pedido cargado con sus eventos (pedido de la tabla, no fila del Panel). */
export function orderSegmentInput(o: any): SegmentInput {
  return {
    langPair: o.langPair ?? null,
    assignedTo: o.assignedTo ?? null,
    client: o.clientName?.trim() || o.clientEmail || "",
    paymentMethod: o.paymentMethod ?? null,
    channel: o.acquisitionSource ?? getAcquisitionSource(o),
  };
}

export function segmentOf(o: SegmentInput): Segment {
  return {
    lengua: originLabel(o.langPair),
    par: pairLabel(o.langPair),
    trad: translatorLabel(o),
    cliente: o.client,
    canal: channelLabel(o.channel),
    via: paymentLabel(o.paymentMethod),
  };
}

const norm = (s: string) => s.trim().toLowerCase();

/** `get` lee un parámetro de la URL. Cada valor va con encodeURIComponent y se separa por comas: f_lengua=nl,de */
export function parseSlicers(get: (param: string) => string | null | undefined): Slicers {
  const out: Slicers = {};
  for (const s of SLICERS) {
    const raw = get(s.param);
    if (!raw) continue;
    const values = raw
      .split(",")
      .map((v) => {
        try {
          return decodeURIComponent(v).trim();
        } catch {
          return v.trim();
        }
      })
      .filter(Boolean);
    if (values.length) out[s.key] = values;
  }
  return out;
}

/** Pares [parámetro, valor] listos para URLSearchParams. */
export function slicerParams(f: Slicers): [string, string][] {
  return SLICERS.flatMap((s) => {
    const v = f[s.key];
    return v?.length ? [[s.param, v.map(encodeURIComponent).join(",")] as [string, string]] : [];
  });
}

export const hasSlicers = (f: Slicers) => SLICERS.some((s) => f[s.key]?.length);

/** Todos los segmentadores activos deben cumplirse; dentro de uno, basta cualquiera de sus valores. */
export function matchesSlicers(seg: Segment, f: Slicers): boolean {
  return SLICERS.every((s) => {
    const want = f[s.key];
    return !want?.length || want.some((w) => norm(w) === norm(seg[s.key]));
  });
}

export const matchesOrderSlicers = (o: any, f: Slicers) => !hasSlicers(f) || matchesSlicers(segmentOf(orderSegmentInput(o)), f);

export function filterPanelData(data: PanelData, f: Slicers): PanelData {
  if (!hasSlicers(f)) return data;
  return { ...data, orders: data.orders.filter((o) => matchesSlicers(segmentOf(o), f)) };
}

export type SlicerOption = { value: string; count: number };

/** Valores disponibles por segmentador, de más a menos pedidos. `keep` conserva los ya elegidos aunque no aparezcan. */
export function slicerOptions(inputs: SegmentInput[], keep: Slicers = {}): Record<SlicerKey, SlicerOption[]> {
  const out = {} as Record<SlicerKey, SlicerOption[]>;
  const segs = inputs.map(segmentOf);
  for (const s of SLICERS) {
    const counts = new Map<string, number>();
    for (const seg of segs) counts.set(seg[s.key], (counts.get(seg[s.key]) ?? 0) + 1);
    for (const k of keep[s.key] ?? []) if (![...counts.keys()].some((v) => norm(v) === norm(k))) counts.set(k, 0);
    out[s.key] = [...counts]
      .filter(([v]) => v)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es"))
      .slice(0, 300);
  }
  return out;
}

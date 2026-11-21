// Única fuente de los enlaces de staff (zona traductor). Sin imports: lo usan módulos que corren bajo node --test.
// Relativos (`href*`) para pantallas; `abs(path, base?)` los vuelve absolutos para emails/SMS/avisos.
export const STAFF_SITE = "https://www.traduccionesjuradas.net";
const Z = "/zona-traductor";

/** Concatena sin tocar nada: la base la pone quien llama (NEXTAUTH_URL, SITE…) o, por defecto, la web pública. */
export const abs = (path: string, base: string = STAFF_SITE) => `${base}${path}`;

type Params = Record<string, string | number | null | undefined> | URLSearchParams;
const qs = (p?: Params): string => {
  if (!p) return "";
  if (p instanceof URLSearchParams) return p.toString();
  return Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
};
const withQs = (path: string, p?: Params) => {
  const q = qs(p);
  return q ? `${path}?${q}` : path;
};

export const hrefZona = () => Z;
export const hrefHoy = () => `${Z}/hoy`;
/** Ficha del caso: una sola constante para decidir cuál de las dos fichas (casos / caso) gana. */
export const CASO_BASE = `${Z}/casos`;
export const hrefCaso = (casoId: string) => `${CASO_BASE}/${casoId}`;
export const hrefPresupuesto = (quoteId: string) => `${Z}/presupuestos/${quoteId}`;
export const hrefPedido = (reference: string) => `${Z}/pedido/${encodeURIComponent(reference)}`;
export const hrefCliente = (email: string) => `${Z}/clientes/${encodeURIComponent(email)}`;
/** Constructor de presupuestos. `params`: lead, session, inbox, exp, customerEmail… (encodeURIComponent por valor). */
export const hrefConstructor = (params?: Params) => withQs(`${Z}/presupuesto`, params);
/** Bandeja de entrada de staff. */
export const hrefBandeja = (id?: string) => (id ? `/admin/inbox?id=${encodeURIComponent(id)}` : "/admin/inbox");
/** Lector de requerimientos; solo vive con LECTURA_CONSTRUCTOR=on (ver lib/lectura-constructor/flag.ts). */
export const hrefLectura = (params?: Params) => withQs(`${Z}/lectura`, params);
export const hrefVigia = () => `${Z}/vigia`;
export const hrefTarifario = () => `${Z}/tarifario`;
export const hrefFacturas = () => `${Z}/facturas`;
export const hrefPresupuestos = () => `${Z}/presupuestos`;
/** Solicitud de precio en lavori: constructor atado a la solicitud. */
export function hrefSolicitud(l: { ref: string; expedienteRef: string | null }): string {
  const exp = l.expedienteRef && !l.expedienteRef.startsWith("puerta:") ? `&exp=${encodeURIComponent(l.expedienteRef)}` : "";
  return `${Z}/presupuesto?lead=${encodeURIComponent(l.ref)}${exp}`;
}

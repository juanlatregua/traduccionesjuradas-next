// Grafo de PERSONAS compartido por el vigía y el aviso de lead sin presupuesto.
// Puro (sin Prisma): une presupuestos, solicitudes, leads y pedidos pagados por email,
// teléfono, sesión, referencia y huella de documento.
import { PersonIndex, intermediaryEmails, normEmail, personKeys, textKeys } from "./vigia-persona.ts";

export type GraphQuote = { id: string; email: string; phone: string | null; expRef: string | null; name?: string | null; holder?: string | null };
export type GraphSolicitud = { ref: string; customerHint: string | null; expedienteRef: string | null; quoteId: string | null };
export type GraphLead = { clientEmail: string | null; clientName: string | null; clientPhone: string | null; sessionToken: string | null; fileHash: string | null };
export type GraphOrder = { clientEmail: string | null; clientPhone: string | null; clientName: string | null };

export function buildPersonGraph<Q extends GraphQuote, S extends GraphSolicitud, L extends GraphLead, O extends GraphOrder>(input: {
  quotes: Q[];
  solicitudes: S[];
  leadDocs: L[];
  paidOrders: O[];
  hashesOfQuote: Map<string, string[]>;
}) {
  const { quotes, solicitudes, leadDocs, paidOrders, hashesOfQuote } = input;
  const multi = intermediaryEmails(quotes);
  const quoteKeys = (q: Q) => multi.has(normEmail(q.email)) ? personKeys({ refs: [q.expRef], hashes: hashesOfQuote.get(q.id), quoteIds: [q.id] }) : personKeys({ emails: [q.email], phones: [q.phone], refs: [q.expRef], hashes: hashesOfQuote.get(q.id), quoteIds: [q.id] });
  const solKeys = (s: S) => [...textKeys(s.customerHint), ...personKeys({ refs: [s.expedienteRef], quoteIds: [s.quoteId] }), `r:${s.ref}`];
  const leadKeys = (d: L) => personKeys({ emails: [d.clientEmail], phones: [d.clientPhone], sessions: [d.sessionToken], hashes: [d.fileHash] });
  const orderKeys = (o: { clientEmail: string | null; clientPhone: string | null }) => personKeys({ emails: [o.clientEmail], phones: [o.clientPhone] });
  // Huella del documento: une lead↔solicitud↔presupuesto de quien no ha comprado; nunca arrastra
  // a otra persona a quien ya pagó (otro email y otro teléfono con el mismo PDF).
  const graphItems: { keys: string[]; name?: string | null }[] = [
    ...quotes.map((q) => ({ keys: quoteKeys(q), name: q.name })),
    ...solicitudes.map((x) => ({ keys: solKeys(x) })),
    ...leadDocs.map((d) => ({ keys: leadKeys(d), name: d.clientName })),
    ...paidOrders.map((o) => ({ keys: orderKeys(o), name: o.clientName })),
  ];
  const idx0 = new PersonIndex(graphItems.map((i) => ({ ...i, keys: i.keys.filter((k) => !k.startsWith("h:")) })));
  const paid0 = new Set(paidOrders.map((o) => idx0.rootOf(orderKeys(o))).filter((r): r is string => !!r));
  const idx = new PersonIndex(graphItems.map((i) => { const r0 = idx0.rootOf(i.keys.filter((k) => !k.startsWith("h:"))); return r0 && paid0.has(r0) ? { ...i, keys: i.keys.filter((k) => !k.startsWith("h:")) } : i; }));
  const rootOf = (keys: string[]) => idx.rootOf(keys) ?? keys[0] ?? null;
  const quotesOfRoot = new Map<string, Q[]>();
  for (const q of quotes) { const r = rootOf(quoteKeys(q)); if (r) quotesOfRoot.set(r, [...(quotesOfRoot.get(r) || []), q]); }
  const solsOfRoot = new Map<string, S[]>();
  for (const s of solicitudes) { const r = rootOf(solKeys(s)); if (r) solsOfRoot.set(r, [...(solsOfRoot.get(r) || []), s]); }
  const paidRoots = new Set(paidOrders.map((o) => rootOf(orderKeys(o))).filter((r): r is string => !!r));
  return { idx, rootOf, quoteKeys, solKeys, leadKeys, orderKeys, quotesOfRoot, solsOfRoot, paidRoots };
}

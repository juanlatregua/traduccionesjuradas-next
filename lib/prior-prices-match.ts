export type PriorPrice = {
  unitPrice: number;
  supplierUnitCost: number | null;
  quoteNumber: string;
  issuedAt: string;
  status: string;
  translatorName: string | null;
  /** Precio de ESTE mismo cliente (se prioriza sobre los de otros). */
  own?: boolean;
  /** Presupuesto ya pagado: precio cerrado con el cliente. */
  paid?: boolean;
  /** Cantidad y páginas de la línea anterior: un precedente solo vale tal cual si el documento es del mismo tamaño. */
  quantity?: number;
  pages?: number | null;
};

export type PriorLine = PriorPrice & { description: string; paid: boolean; issuedMs: number; docKind?: string | null };

export const PRIOR_STATUSES = ["SENT", "OPENED", "ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED"] as const;
const MIN_FUZZY_CHARS = 8;
// Tipos comodín: casarían cualquier documento con cualquier otro.
const GENERIC_KINDS = new Set(["other", "unknown", "expediente_combinado"]);

export function matchableDocKind(raw: string | null | undefined): string | null {
  const k = String(raw || "");
  return /^[a-z0-9_]{2,60}$/.test(k) && !GENERIC_KINDS.has(k) ? k : null;
}
const MAX_MATCHES = 3;

export function normalizeLabel(raw: string | null | undefined) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Lo que va tras « — » (titular, mes) y «con apostilla» no cambia el tipo de documento.
export function labelOfDescription(description: string | null | undefined) {
  const base = String(description || "").split(" (")[0].split(/\s[—–]\s/)[0];
  return normalizeLabel(base.replace(/\s+con apostilla\b.*$/i, ""));
}

// Difusa solo por prefijo de 2+ palabras: «carta de suscripcion» ↔ «… de acciones»
// sí; «certificado» o «apostilla» sueltos casaban con cualquier certificado/apostilla.
export function labelsMatch(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_FUZZY_CHARS && short.includes(" ") && long.startsWith(short + " ");
}

export function pickPriorMatches(lines: PriorLine[], label: string, rawDocKind?: string | null): PriorPrice[] {
  const target = normalizeLabel(label);
  const docKind = matchableDocKind(rawDocKind);
  const seen = new Set<string>();
  return lines
    .filter((l) => (!!docKind && l.docKind === docKind) || labelsMatch(labelOfDescription(l.description), target))
    .sort((a, b) => Number(!!b.own) - Number(!!a.own) || Number(b.paid) - Number(a.paid) || b.issuedMs - a.issuedMs)
    .filter((l) => {
      const k = `${l.quoteNumber}|${l.unitPrice}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_MATCHES)
    .map(({ unitPrice, supplierUnitCost, quoteNumber, issuedAt, status, translatorName, own, paid, quantity, pages }) => ({
      unitPrice,
      quantity: quantity ?? 1,
      pages: pages ?? null,
      supplierUnitCost,
      quoteNumber,
      issuedAt,
      status,
      translatorName,
      ...(own ? { own: true } : {}),
      ...(paid ? { paid: true } : {}),
    }));
}

// Precedente que puede aplicarse SOLO (sin que el staff lo pulse): del mismo cliente,
// pagado, con coste del jurado, una unidad y el mismo tamaño (o, sin páginas
// guardadas, un documento corto).
export function isAutoApplicablePrior(m: PriorPrice | undefined, pages: number | undefined): boolean {
  if (!m || !m.own || !m.paid || m.supplierUnitCost == null || (m.quantity ?? 1) !== 1) return false;
  const p = pages || 1;
  return m.pages != null ? m.pages === p : p <= 2;
}

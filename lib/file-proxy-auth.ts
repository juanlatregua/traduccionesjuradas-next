// Autorización del proxy /api/files/[...path] (blobs privados). Puro: las
// consultas llegan inyectadas para probarlo con node --test.
// Regla: la credencial abre SOLO lo que la BD ata a su pedido o presupuesto.

export type FileOrderScope = "client" | "collaborator";

export type FileProxyDeps = {
  isStaff: () => Promise<boolean>;
  verifyOrderToken: (reference: string, token: string) => boolean;
  findOrderId: (reference: string) => Promise<string | null>;
  findAssignment: (token: string) => Promise<{
    orderId: string;
    status: string;
    updatedAt: Date;
    deliveredFileUrl: string | null;
  } | null>;
  findQuote: (publicToken: string) => Promise<{ id: string; tokenExpiresAt: Date | null; deletedAt: Date | null } | null>;
  orderHasBlob: (orderId: string, url: string, scope: FileOrderScope) => Promise<boolean>;
  quoteHasBlob: (quoteId: string, url: string) => Promise<boolean>;
  blobIsKnown: (url: string) => Promise<boolean>;
};

export type FileAuth = { ok: true; via: "staff" | "client" | "collaborator" | "quote" } | { ok: false; status: 401 | 403 };

// Mismo criterio que /api/encargo/[token]: cerrado hace más de 30 días, caducado.
const ASSIGNMENT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

const DENY = { ok: false, status: 403 } as const;

export async function authorizeFile(
  url: string,
  params: URLSearchParams,
  deps: FileProxyDeps,
  now = new Date()
): Promise<FileAuth> {
  const ref = params.get("ref")?.trim() || "";
  const t = params.get("t")?.trim() || "";
  const a = params.get("a")?.trim() || "";
  const q = params.get("q")?.trim() || "";

  if (ref || t) {
    if (!ref || !t || !deps.verifyOrderToken(ref, t)) return DENY;
    const orderId = await deps.findOrderId(ref);
    if (!orderId || !(await deps.orderHasBlob(orderId, url, "client"))) return DENY;
    return { ok: true, via: "client" };
  }

  if (a) {
    const asg = await deps.findAssignment(a);
    if (!asg) return DENY;
    if (["DELIVERED", "REJECTED"].includes(asg.status) && asg.updatedAt.getTime() < now.getTime() - ASSIGNMENT_EXPIRY_MS) {
      return DENY;
    }
    const own = asg.deliveredFileUrl === url || (await deps.orderHasBlob(asg.orderId, url, "collaborator"));
    return own ? { ok: true, via: "collaborator" } : DENY;
  }

  if (q) {
    const quote = await deps.findQuote(q);
    if (!quote || quote.deletedAt) return DENY;
    if (quote.tokenExpiresAt && quote.tokenExpiresAt < now) return DENY;
    return (await deps.quoteHasBlob(quote.id, url)) ? { ok: true, via: "quote" } : DENY;
  }

  if (!(await deps.isStaff())) return { ok: false, status: 401 };
  return (await deps.blobIsKnown(url)) ? { ok: true, via: "staff" } : DENY;
}

/**
 * Ruta cruda del proxy (tal cual la escribió fileLink, sin decodificar) → URL del
 * blob privado. Rechaza vacíos, «.», «..», barras dobles, «\\» y escapes rotos.
 */
export function blobUrlFromProxyPath(rawPath: string, privateHost: string | null): string | null {
  if (!privateHost || !rawPath) return null;
  const segments = rawPath.split("/");
  for (const s of segments) {
    let d: string;
    try {
      d = decodeURIComponent(s);
    } catch {
      return null;
    }
    if (!d || d === "." || d === ".." || d.includes("/") || d.includes("\\")) return null;
  }
  return `https://${privateHost}/${rawPath}`;
}

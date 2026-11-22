// lib/quote-content-version.ts — Hash de la versión de contenido del presupuesto (ver
// quoteContentKey en lib/quote-edit-hydrate.ts). Solo servidor (crypto).

import crypto from "crypto";
import { quoteContentKey } from "./quote-edit-hydrate.ts";

export function quoteContentVersion(q: unknown): string {
  return crypto.createHash("sha256").update(quoteContentKey(q)).digest("hex").slice(0, 24);
}

// lib/legalization/hcch-table.ts
//
// Tabla país → régimen de legalización, como DATO VERSIONADO EN GIT (no en el
// prompt de IA). Es input para que el lector de requerimientos sugiera una
// HIPÓTESIS de legalización; NUNCA decide de forma afirmativa. El default
// seguro para cualquier país no listado o en duda es "unknown" → la UI lo
// traduce a "verify_with_authority".
//
// REGLA YMYL: estos datos se verificaron contra la fuente oficial (HCCH) en la
// fecha `lastReviewed`. Tienen dueño de revisión (ver CONTEXT.md). Si la fecha
// envejece, la UI lo muestra y el default sigue siendo "verifica con el organismo".
//
// Fuente: Conferencia de La Haya de Derecho Internacional Privado (HCCH),
// tabla de estado del Convenio de la Apostilla (Convenio nº 12, de 5-X-1961).

export type LegalizationRegime =
  | "apostille" // país parte del Convenio de La Haya → apostilla
  | "consular" // no es parte → legalización consular (vía diplomática)
  | "eu-1191-exempt" // UE: Reg. 2016/1191 exime apostilla para ciertos doc. públicos entre EM
  | "unknown"; // sin dato fiable → verificar con el organismo

export type HcchEntry = {
  regime: LegalizationRegime;
  /** Entrada en vigor del Convenio para ese país (informativo). */
  inForce?: string;
  /** Países entre los que NO aplica la apostilla por objeción a la adhesión. */
  objections?: string[];
  /** Matiz obligatorio que la UI debe mostrar junto al régimen. */
  note?: string;
};

export const HCCH_TABLE: {
  lastReviewed: string;
  source: string;
  entries: Record<string, HcchEntry>;
} = {
  lastReviewed: "2026-06-02",
  source: "https://www.hcch.net/en/instruments/conventions/status-table/?cid=41",
  entries: {
    // ── Magreb / África francófona (núcleo del nicho FR) ──────────────
    MA: {
      regime: "apostille",
      inForce: "2016-08-14",
      note: "Marruecos es parte del Convenio de La Haya: apostilla. Confírmalo con la autoridad marroquí competente.",
    },
    DZ: {
      // Verificado en hcch.net (status table cid=41) el 2026-07-09: adhesión
      // 5-XI-2025, entrada en vigor 9-VII-2026.
      regime: "apostille",
      inForce: "2026-07-09",
      note: "Argelia es parte del Convenio de La Haya desde el 9 de julio de 2026: apostilla. Los documentos legalizados por vía consular antes de esa fecha siguen siendo válidos. Confírmalo con la autoridad argelina competente.",
    },
    TN: {
      regime: "apostille",
      inForce: "2018-03-30",
      note: "Túnez es parte del Convenio de La Haya: apostilla. Confírmalo con la autoridad tunecina competente.",
    },
    SN: {
      regime: "apostille",
      inForce: "2023-03-23",
      note: "Senegal es parte del Convenio de La Haya: apostilla. Confírmalo con la autoridad senegalesa competente.",
    },
    CI: {
      regime: "consular",
      note: "Costa de Marfil no es parte del Convenio de La Haya: requiere legalización por vía consular/diplomática, no apostilla. Confírmalo.",
    },
    ML: {
      regime: "consular",
      note: "Mali no es parte del Convenio de La Haya: legalización consular, no apostilla. Confírmalo.",
    },
    GN: {
      regime: "consular",
      note: "Guinea no es parte del Convenio de La Haya: legalización consular, no apostilla. Confírmalo.",
    },
    CM: {
      regime: "consular",
      note: "Camerún no es parte del Convenio de La Haya: legalización consular, no apostilla. Confírmalo.",
    },

    // ── UE (Reglamento 2016/1191) ────────────────────────────────────
    FR: {
      regime: "eu-1191-exempt",
      note: "Francia (UE): el Reglamento (UE) 2016/1191 exime de apostilla ciertos documentos públicos (estado civil, etc.) entre Estados miembros. Para otros documentos puede seguir exigiéndose apostilla. Verifica el documento concreto.",
    },
    IT: {
      regime: "eu-1191-exempt",
      note: "Italia (UE): el Reglamento (UE) 2016/1191 exime de apostilla ciertos documentos públicos entre Estados miembros. Para otros puede exigirse apostilla. Verifica.",
    },
    DE: {
      regime: "eu-1191-exempt",
      note: "Alemania (UE): el Reglamento (UE) 2016/1191 exime de apostilla ciertos documentos públicos entre Estados miembros. Para otros puede exigirse apostilla. Verifica.",
    },
    PT: {
      regime: "eu-1191-exempt",
      note: "Portugal (UE): el Reglamento (UE) 2016/1191 exime de apostilla ciertos documentos públicos entre Estados miembros. Para otros puede exigirse apostilla. Verifica.",
    },
    ES: {
      regime: "eu-1191-exempt",
      note: "España es, normalmente, el país de destino del trámite.",
    },

    // ── Otros frecuentes ─────────────────────────────────────────────
    GB: {
      regime: "apostille",
      note: "Reino Unido: parte del Convenio de La Haya (apostilla). Tras el Brexit NO le aplica el Reglamento (UE) 2016/1191. Confírmalo.",
    },
    BR: {
      regime: "apostille",
      inForce: "2016-08-14",
      note: "Brasil es parte del Convenio de La Haya: apostilla. Confírmalo con la autoridad brasileña competente.",
    },
  },
};

/**
 * Devuelve la hipótesis de régimen para un país (ISO-3166 alpha-2). Normaliza
 * "UK" → "GB". País no listado o nulo → "unknown" (la UI lo trata como
 * "verifica con el organismo"). NUNCA es una afirmación: es una hipótesis.
 */
export function lookupRegime(
  iso2: string | null | undefined
): HcchEntry & { iso2: string | null } {
  if (!iso2 || typeof iso2 !== "string") return { regime: "unknown", iso2: null };
  const raw = iso2.trim().toUpperCase();
  const code = raw === "UK" ? "GB" : raw;
  const entry = HCCH_TABLE.entries[code];
  return entry ? { ...entry, iso2: code } : { regime: "unknown", iso2: code };
}

export type AiDocType =
  | "registro_civil"
  | "academico"
  | "juridico_notarial"
  | "laboral"
  | "mercantil"
  | "identidad"
  | "otro";

export type AiAnalysis = {
  documentType: AiDocType;
  hasApostille: boolean;
  suggestedUrgency: "normal" | "urgente24";
  warnings: string[];
  confidence: number;
};

const DOC_PATTERNS: Array<{ type: AiDocType; re: RegExp }> = [
  { type: "registro_civil", re: /\b(nacimiento|matrimonio|defuncion|registro civil|acte de naissance|acte de mariage)\b/i },
  { type: "academico", re: /\b(expediente|titulo|diploma|universitario|delf|dalf|transcript|certificat d'etudes)\b/i },
  { type: "juridico_notarial", re: /\b(sentencia|escritura|notarial|testamento|herencia|poder notarial|acta)\b/i },
  { type: "laboral", re: /\b(contrato|nomina|vida laboral|attestation de travail|ficha salarial)\b/i },
  { type: "mercantil", re: /\b(kbis|registro mercantil|estatutos|sociedad|cuentas anuales|mercantil)\b/i },
  { type: "identidad", re: /\b(pasaporte|dni|nie|permiso de conducir|carte d'identite)\b/i },
];

export function normalizeOcrText(input: string) {
  if (!input) return "";
  return input
    .replace(/-\s*\n\s*/g, "") // une palabras cortadas por guion+salto
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeDocumentForBudget(text: string, words: number): AiAnalysis {
  const normalized = normalizeOcrText(text);
  const warnings: string[] = [];

  let documentType: AiDocType = "otro";
  for (const pattern of DOC_PATTERNS) {
    if (pattern.re.test(normalized)) {
      documentType = pattern.type;
      break;
    }
  }

  const hasApostille = /\b(apostille|apostilla|la haya|haye)\b/i.test(normalized);
  const suggestedUrgency = words <= 350 ? "urgente24" : "normal";

  if (words < 80) {
    warnings.push("Texto OCR escaso: revisa legibilidad o si faltan páginas.");
  }
  if (!hasApostille && /certificado|titulo|expediente|nacimiento|matrimonio/i.test(normalized)) {
    warnings.push("No se detecta apostilla en el texto. Verificar si falta adjuntarla.");
  }
  if (documentType === "identidad" && words < 60) {
    warnings.push("Documento breve: comprobar si falta reverso.");
  }

  const baseConfidence = documentType === "otro" ? 0.55 : 0.78;
  const confidence = Math.max(
    0.35,
    Math.min(0.98, baseConfidence + (words > 150 ? 0.08 : 0) - (warnings.length > 0 ? 0.08 : 0))
  );

  return {
    documentType,
    hasApostille,
    suggestedUrgency,
    warnings,
    confidence: Number(confidence.toFixed(2)),
  };
}

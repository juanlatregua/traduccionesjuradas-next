export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  birth_certificate: "Certificado de nacimiento",
  marriage_certificate: "Certificado de matrimonio",
  death_certificate: "Certificado de defunción",
  divorce_decree: "Sentencia de divorcio",
  criminal_record: "Antecedentes penales",
  passport: "Pasaporte",
  id_card: "Documento de identidad",
  degree: "Título académico",
  transcript: "Expediente académico",
  contract: "Contrato",
  power_of_attorney: "Poder notarial",
  company_registration: "Registro mercantil",
  payslip: "Nómina",
  tax_return: "Declaración fiscal",
  medical_report: "Informe médico",
  apostille: "Apostilla",
  other: "Otro documento",
};

const INTERNAL_CODE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

/** Etiqueta legible de un tipo documental; un texto que no es código interno sale tal cual. */
export function documentTypeLabel(raw: string | null | undefined): string | undefined {
  const t = String(raw || "").trim();
  if (!t) return undefined;
  if (DOCUMENT_TYPE_LABELS[t]) return DOCUMENT_TYPE_LABELS[t];
  return INTERNAL_CODE.test(t) ? t.replace(/_/g, " ") : t;
}

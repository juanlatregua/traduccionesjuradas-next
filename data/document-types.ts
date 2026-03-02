// data/document-types.ts — Catálogo de tipos de documentos

export type DocumentTypeInfo = {
  key: string;
  category: string;
  labelEs: string;
  labelFr: string;
  labelEn: string;
  typicalPages: number;
  typicalWords: [number, number]; // [min, max]
};

export const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  // Registro civil
  { key: "birth_certificate", category: "civil_registry", labelEs: "Certificado de nacimiento", labelFr: "Acte de naissance", labelEn: "Birth certificate", typicalPages: 1, typicalWords: [200, 400] },
  { key: "marriage_certificate", category: "civil_registry", labelEs: "Certificado de matrimonio", labelFr: "Acte de mariage", labelEn: "Marriage certificate", typicalPages: 1, typicalWords: [250, 450] },
  { key: "death_certificate", category: "civil_registry", labelEs: "Certificado de defunción", labelFr: "Acte de décès", labelEn: "Death certificate", typicalPages: 1, typicalWords: [200, 350] },
  { key: "divorce_decree", category: "civil_registry", labelEs: "Sentencia de divorcio", labelFr: "Jugement de divorce", labelEn: "Divorce decree", typicalPages: 3, typicalWords: [800, 2500] },

  // Identidad
  { key: "passport", category: "identity", labelEs: "Pasaporte", labelFr: "Passeport", labelEn: "Passport", typicalPages: 1, typicalWords: [80, 150] },
  { key: "id_card", category: "identity", labelEs: "Documento de identidad", labelFr: "Carte d'identité", labelEn: "ID card", typicalPages: 1, typicalWords: [60, 120] },

  // Antecedentes
  { key: "criminal_record", category: "civil_registry", labelEs: "Antecedentes penales", labelFr: "Casier judiciaire", labelEn: "Criminal record", typicalPages: 1, typicalWords: [150, 350] },

  // Académicos
  { key: "degree", category: "academic", labelEs: "Título académico", labelFr: "Diplôme", labelEn: "Degree", typicalPages: 1, typicalWords: [150, 350] },
  { key: "transcript", category: "academic", labelEs: "Expediente académico", labelFr: "Relevé de notes", labelEn: "Transcript", typicalPages: 3, typicalWords: [400, 1200] },

  // Legal
  { key: "contract", category: "legal", labelEs: "Contrato", labelFr: "Contrat", labelEn: "Contract", typicalPages: 5, typicalWords: [800, 2000] },
  { key: "power_of_attorney", category: "legal", labelEs: "Poder notarial", labelFr: "Procuration", labelEn: "Power of attorney", typicalPages: 2, typicalWords: [500, 1500] },

  // Mercantil
  { key: "company_registration", category: "financial", labelEs: "Registro mercantil / KBis", labelFr: "Extrait KBis", labelEn: "Company registration", typicalPages: 1, typicalWords: [200, 500] },

  // Laboral
  { key: "payslip", category: "labor", labelEs: "Nómina", labelFr: "Bulletin de salaire", labelEn: "Payslip", typicalPages: 1, typicalWords: [150, 350] },

  // Financiero
  { key: "tax_return", category: "financial", labelEs: "Declaración fiscal", labelFr: "Déclaration fiscale", labelEn: "Tax return", typicalPages: 2, typicalWords: [300, 800] },

  // Médico
  { key: "medical_report", category: "medical", labelEs: "Informe médico", labelFr: "Rapport médical", labelEn: "Medical report", typicalPages: 2, typicalWords: [400, 1200] },

  // Apostilla
  { key: "apostille", category: "legal", labelEs: "Apostilla", labelFr: "Apostille", labelEn: "Apostille", typicalPages: 1, typicalWords: [50, 100] },

  // Otros
  { key: "other", category: "other", labelEs: "Otro documento", labelFr: "Autre document", labelEn: "Other document", typicalPages: 1, typicalWords: [200, 500] },
];

export function getDocumentTypeInfo(key: string): DocumentTypeInfo | undefined {
  return DOCUMENT_TYPES.find((dt) => dt.key === key);
}

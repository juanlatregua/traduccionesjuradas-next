export type DocumentCategory = {
  slug: string;
  title: string;
  description: string;
  checklist: string[];
  formatTips: string[];
  legalNotes?: string[];
  exampleUrl?: string; // placeholder demo; no PII
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    slug: "certificados-registro-civil",
    title: "Certificados del Registro Civil",
    description:
      "Nacimiento, matrimonio, defunción, fe de vida y estado. Usados en extranjería, nacionalidad y trámites familiares.",
    checklist: [
      "Datos legibles (nombres completos, fechas, sellos) y sin recortes.",
      "Confirma si necesitas apostilla/legalización en el país de origen.",
      "Incluye todas las páginas o anotaciones marginales.",
    ],
    formatTips: [
      "PDF o foto nítida; evita sombras o brillos en la zona sellada.",
      "Si tienes varias caras, envíalas en un único PDF o numeradas.",
    ],
    legalNotes: [
      "Para legalizar la traducción, se requiere copia en papel firmada y sellada por el traductor jurado.",
    ],
    exampleUrl: "/recursos/ejemplo-certificado.pdf", // mock; reemplazar si se publica un ejemplo anon.
  },
  {
    slug: "documentos-academicos",
    title: "Documentos académicos",
    description:
      "Títulos universitarios, certificados de notas, diplomas y programas de estudios.",
    checklist: [
      "Comprueba que aparecen el nombre completo y el número de páginas.",
      "Incluye anexos o programas si los requiere la universidad de destino.",
      "Confirma si debes aportar sello húmedo o firma digital del centro.",
    ],
    formatTips: [
      "PDF oficial o escaneo a color; evita fotos inclinadas o borrosas.",
      "Si son varios PDFs, indica el orden (título, notas, programa).",
    ],
    legalNotes: [
      "Si se exige legalización/apostilla, el PDF firmado digitalmente no basta: se necesita traducción en papel.",
    ],
    exampleUrl: "/recursos/ejemplo-academico.pdf",
  },
  {
    slug: "documentos-juridicos",
    title: "Documentos jurídicos y notariales",
    description:
      "Contratos, escrituras notariales, poderes, sentencias y otros documentos legales.",
    checklist: [
      "Revisa que estén todas las cláusulas y anexos.",
      "Confirma si requieren apostilla/legalización antes de traducir.",
      "Incluye datos de las partes y sellos/notas registrales si existen.",
    ],
    formatTips: [
      "PDF escaneado a color; evita cortes en los márgenes o sellos.",
      "Si hay varias escrituras, numera los archivos y ordena anexos.",
    ],
    legalNotes: [
      "Trámites notariales y registros suelen exigir la traducción en papel firmada y sellada.",
    ],
    exampleUrl: "/recursos/ejemplo-juridico.pdf",
  },
  {
    slug: "documentos-mercantiles",
    title: "Documentos mercantiles y empresariales",
    description:
      "Cuentas anuales, balances, estatutos, poderes mercantiles, actas y certificados registrales.",
    checklist: [
      "Incluye portadas, certificaciones y anotaciones registrales.",
      "Confirma si el organismo pide traducción de la apostilla/legalización.",
      "Aclara si necesitas varias copias para distintos expedientes.",
    ],
    formatTips: [
      "PDF completo y legible; separa por documentos si son varios.",
      "Evita fotos parciales; mejor un único PDF ordenado.",
    ],
    legalNotes: [
      "Para legalización/apostilla, la traducción debe ser en papel con firma y sello original.",
    ],
    exampleUrl: "/recursos/ejemplo-mercantil.pdf",
  },
];

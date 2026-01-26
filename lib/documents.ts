export type DocumentExample = {
  label: string;
  url: string;
};

export type DocumentCategory = {
  slug: string;
  title: string;
  description: string;
  checklist: string[];
  formatTips: string[];
  legalNotes?: string[];
  examples?: DocumentExample[];
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
    examples: [
      { label: "Certificado nacimiento (ES)", url: "/recursos/certificado-literal-de-nacimiento.pdf" },
      { label: "Antecedentes penales (BR)", url: "/recursos/PENAL--brasil.pdf" },
      { label: "Certificado penal (Madagascar)", url: "/recursos/bulletin-n3-madagascar.pdf" },
    ],
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
    examples: [
      { label: "Certificado de residencia (CNIE)", url: "/recursos/certificat-de-residence-pour-obtenir-le-CNIE.pdf" },
    ],
  },
  {
    slug: "documentos-laborales",
    title: "Documentos laborales y teletrabajo",
    description:
      "Nóminas, certificados de empresa, certificados de saldo bancario, EM10 / desplazamiento y otros documentos laborales.",
    checklist: [
      "Incluye nóminas y certificados de empresa con fechas y firmas visibles.",
      "Aporta certificados de desplazamiento (EM10) o residencia si te lo piden para teletrabajo.",
      "Si hay saldo bancario, comprueba que figure titular y moneda.",
    ],
    formatTips: [
      "PDF o fotos nítidas; evita sombras sobre importes y firmas.",
      "Agrupa por mes/orden; si son muchas nóminas, indícalo.",
    ],
    legalNotes: [
      "Para trámites con apostilla/legalización, la traducción debe entregarse en papel con firma y sello original.",
    ],
    examples: [
      { label: "Certificado de desplazamiento (EM10)", url: "/recursos/certificat-de-detachement---certificado-de-desplazamiento-EM10.pdf" },
      { label: "Saldo bancario Marruecos", url: "/recursos/certificat-de-solde-maroc-certificado-de-saldo-bancario-marruecos.pdf" },
    ],
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
    examples: [{ label: "Contrato de matrimonio", url: "/recursos/contrat-de-marriage.pdf" }],
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
    examples: [
      { label: "Kbis Francia", url: "/recursos/kbis-france.pdf" },
      { label: "Saldo bancario Marruecos", url: "/recursos/certificat-de-solde-maroc-certificado-de-saldo-bancario-marruecos.pdf" },
      { label: "Statuts / extrait (FR)", url: "/recursos/extrait-de-la-fiche-anthropometrique-avec-apostille.pdf" },
    ],
  },
];

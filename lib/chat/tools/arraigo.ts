const SITE_URL = "https://www.traduccionesjuradas.net";
const PER_DOC_EUR = 25;
const DEADLINE = "2026-06-30";
const DELIVERY_TIME = "24h";
const PAYMENT_METHODS = ["bizum", "tarjeta", "paypal", "transferencia"];
const UTM = "utm_source=chat&utm_medium=bot&utm_campaign=recommend_arraigo_pack";

const HAGUE_COUNTRIES = new Set(["MA", "SN", "TN", "BR", "GB", "UK", "IT", "FR", "DE", "PT"]);

const COUNTRY_PAGES: Record<string, string> = {
  MA: "/regularizacion-2026/marruecos",
  SN: "/regularizacion-2026/senegal",
  CI: "/regularizacion-2026/costa-de-marfil",
  ML: "/regularizacion-2026/mali",
  GN: "/regularizacion-2026/guinea",
  CM: "/regularizacion-2026/camerun",
};

const COUNTRY_NAMES: Record<string, string> = {
  MA: "Marruecos",
  SN: "Senegal",
  CI: "Costa de Marfil",
  ML: "Mali",
  GN: "Guinea-Conakry",
  CM: "Camerún",
  BF: "Burkina Faso",
  TG: "Togo",
  BJ: "Benín",
  CD: "RD Congo",
  DZ: "Argelia",
  TN: "Túnez",
  GB: "Reino Unido",
  UK: "Reino Unido",
  BR: "Brasil",
  IT: "Italia",
};

export type ArraigoFigura =
  | "arraigo_extraordinario"
  | "proteccion_internacional"
  | "social"
  | "sociolaboral"
  | "familiar"
  | "formacion"
  | "segunda_oportunidad"
  | "unknown";

export type RecommendArraigoPackInput = {
  country_of_origin?: string;
  figura?: ArraigoFigura;
  presence_before_2026_01_01?: boolean;
  employment_90_days?: boolean;
  has_minor_children?: boolean;
  vulnerability?: boolean;
  protection_application_before_2026_01_01?: boolean;
  residence_5_months?: boolean;
  has_marriage?: boolean;
};

function withUtm(path: string): string {
  if (!path) return "";
  const sep = path.includes("?") ? "&" : "?";
  return `${SITE_URL}${path}${sep}${UTM}`;
}

function evaluateEligibility(
  input: RecommendArraigoPackInput,
): {
  eligible: boolean;
  via: string;
  reason: string;
} {
  const figura = input.figura;

  if (figura === "proteccion_internacional") {
    const ok =
      input.protection_application_before_2026_01_01 === true &&
      input.residence_5_months === true;
    return {
      eligible: ok,
      via: ok ? "proteccion_internacional_da20" : "no_eligible",
      reason: ok
        ? "Vía DA 20ª: solicitud de protección internacional anterior al 01-01-2026 + 5 meses de residencia continua acreditados."
        : "Para la vía DA 20ª se requiere solicitud de protección internacional presentada antes del 01-01-2026 y al menos 5 meses de permanencia continua en España.",
    };
  }

  // Por defecto evaluamos arraigo extraordinario (DA 21ª)
  if (input.presence_before_2026_01_01 === false) {
    return {
      eligible: false,
      via: "no_eligible",
      reason:
        "Para la regularización extraordinaria 2026 hay que estar en España antes del 01-01-2026 (RD 316/2026, DA 21ª).",
    };
  }
  const hasAnchor =
    input.employment_90_days === true ||
    input.has_minor_children === true ||
    input.vulnerability === true;

  if (input.presence_before_2026_01_01 === true && hasAnchor) {
    return {
      eligible: true,
      via: "arraigo_extraordinario_da21",
      reason:
        "Vía DA 21ª: presencia en España antes del 01-01-2026 + supuesto acreditable (empleo 90 días, menores a cargo o vulnerabilidad).",
    };
  }

  return {
    eligible: false,
    via: "unknown",
    reason:
      "No hay datos suficientes para confirmar elegibilidad. Pregunta por presencia antes del 01-01-2026 y por uno de los tres supuestos: empleo 90 días, menores a cargo o vulnerabilidad.",
  };
}

function buildDocumentList(input: RecommendArraigoPackInput): string[] {
  const docs: string[] = [];
  docs.push("Antecedentes penales del país de origen (y de cualquier país donde se haya residido en los últimos 5 años).");
  docs.push("Pasaporte (vigente o caducado).");
  if (input.has_minor_children) {
    docs.push("Acta de nacimiento del solicitante.");
    docs.push("Acta de nacimiento de los menores a cargo (si nacieron en el extranjero).");
  }
  if (input.has_marriage) {
    docs.push("Acta de matrimonio.");
  }
  return docs;
}

function isHague(country: string | undefined): boolean {
  if (!country) return false;
  const c = country.toUpperCase();
  if (c === "DZ") return false;
  return HAGUE_COUNTRIES.has(c);
}

export function recommendArraigoPack(input: RecommendArraigoPackInput) {
  const country = (input.country_of_origin || "").toUpperCase();
  const eligibility = evaluateEligibility(input);
  const documents = buildDocumentList(input);
  const docCount = documents.filter((d) =>
    /antecedentes|acta|matrimonio|nacimiento/i.test(d),
  ).length;

  const subtotal = docCount * PER_DOC_EUR;
  const apostilleRequired = isHague(country);
  const consularLegalizationRequired = country && !apostilleRequired;
  const countryPage = COUNTRY_PAGES[country];
  const countryName = COUNTRY_NAMES[country] || country || null;

  const notes: string[] = [];
  notes.push(
    "Validez del certificado de antecedentes penales: la administración exige menos de 3 meses desde su emisión.",
  );
  notes.push(
    "Lookback de 5 años: si has residido en otros países en los últimos 5 años, necesitas certificado de cada uno (RD 316/2026, art. 130).",
  );
  if (apostilleRequired) {
    notes.push(
      `Apostilla de La Haya obligatoria en ${countryName || "el país emisor"} antes de la traducción jurada.`,
    );
  }
  if (consularLegalizationRequired) {
    notes.push(
      `${countryName || "El país"} no aplica la Apostilla de La Haya: requiere legalización consular en cadena (Ministerio de Asuntos Exteriores del país + Consulado/Embajada de España). Plazo realista: varias semanas.`,
    );
  }
  if (country === "DZ") {
    notes.push(
      "Argelia: Convenio de La Haya en vigor el 09-07-2026; hoy todavía requiere legalización consular.",
    );
  }

  const ctas: { label: string; url: string }[] = [];
  if (countryPage) {
    ctas.push({
      label: `Guía ${countryName} para la regularización 2026`,
      url: withUtm(countryPage),
    });
  } else {
    ctas.push({
      label: "Hub regularización extraordinaria 2026",
      url: withUtm("/regularizacion-2026"),
    });
  }
  ctas.push({
    label: "Iniciar pedido con tarifa 25 €/doc",
    url: withUtm("/start?p=regularizacion-2026"),
  });

  return {
    eligible: eligibility.eligible,
    via: eligibility.via,
    reason: eligibility.reason,
    deadline: DEADLINE,
    country: country || null,
    country_name: countryName,
    country_page_url: countryPage ? withUtm(countryPage) : null,
    apostille_required: apostilleRequired,
    consular_legalization_required: Boolean(consularLegalizationRequired),
    documents_required: documents,
    pricing: {
      per_doc_eur: PER_DOC_EUR,
      doc_count: docCount,
      subtotal_eur: subtotal,
      currency: "EUR",
      vat_included: false,
    },
    delivery_time: DELIVERY_TIME,
    payment_methods: PAYMENT_METHODS,
    ctas,
    notes,
    sources: [
      "RD 316/2026 (BOE-A-2026-8284)",
      "RD 1155/2024 (BOE-A-2024-24099) art. 130",
      "HCCH Apostille Status Table (31-XII-2025)",
    ],
  };
}

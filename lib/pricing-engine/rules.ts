// lib/pricing-engine/rules.ts — Reglas de negocio (mínimos, urgencias, descuentos)

export const MINIMUM_BY_TYPE: Record<string, number> = {
  birth_certificate: 42,
  marriage_certificate: 42,
  death_certificate: 42,
  criminal_record: 42,
  passport: 35,
  id_card: 45,
  divorce_decree: 55,
  degree: 50,
  transcript: 55,
  apostille: 20,
  contract: 60,
  power_of_attorney: 55,
  company_registration: 60,
  payslip: 35,
  medical_report: 50,
  tax_return: 50,
  other: 42,
};

export const DEFAULT_MINIMUM = 42;

export const MINIMUM_BY_LANGUAGE: Record<string, number> = {
  en: 50,
  de: 50,
  nl: 50,
  it: 50,
  pt: 50,
  ca: 50,
  sv: 50,
  no: 50,
  ro: 50,
  ar: 55,
};

export const APOSTILLE_SURCHARGE_BY_LANGUAGE: Record<string, number> = {
  en: 15,
  de: 15,
  nl: 15,
  it: 15,
  pt: 15,
  ca: 15,
  sv: 15,
  no: 15,
  ro: 15,
  ar: 15,
};

export const URGENCY_MULTIPLIER = 1.25; // +25%

export const COMPLEXITY_MULTIPLIER: Record<string, number> = {
  standard: 1.0,
  complex: 1.2,
  highly_complex: 1.5,
};

export const VOLUME_DISCOUNTS = [
  { threshold: 3, discount: 0.05 }, // 3+ documentos: -5%
  { threshold: 5, discount: 0.10 }, // 5+ documentos: -10%
  { threshold: 10, discount: 0.15 }, // 10+ documentos: -15%
];

// Tarifas especiales Marruecos (documentos árabes/franceses) — siempre precio fijo
export const MOROCCO_PRICING: Record<number, number> = {
  1: 40,
  2: 40,
  3: 45,
  4: 55,
  5: 65,
};

export const APOSTILLE_SURCHARGE = 25;

export function getMinimum(specificType: string, langCode?: string): number {
  const typeMin = MINIMUM_BY_TYPE[specificType] || DEFAULT_MINIMUM;
  const langMin = langCode ? MINIMUM_BY_LANGUAGE[langCode] ?? 0 : 0;
  return Math.max(typeMin, langMin);
}

export function getApostilleSurcharge(langCode?: string): number {
  if (langCode && APOSTILLE_SURCHARGE_BY_LANGUAGE[langCode] !== undefined) {
    return APOSTILLE_SURCHARGE_BY_LANGUAGE[langCode];
  }
  return APOSTILLE_SURCHARGE;
}

export function getComplexityMultiplier(level: string): number {
  return COMPLEXITY_MULTIPLIER[level] || 1.0;
}

export function getVolumeDiscount(documentCount: number): number {
  let discount = 0;
  for (const tier of VOLUME_DISCOUNTS) {
    if (documentCount >= tier.threshold) {
      discount = tier.discount;
    }
  }
  return discount;
}

export const REGULARIZACION_FR_DOC_CENTS = 2500;
export const REGULARIZACION_MAX_PAGES = 2;

export function regularizacionFlatApplies(input: {
  purposeIsRegularizacion: boolean;
  foreignLang: string;
  pages: number | null | undefined;
  isFrenchCriminalRecord: boolean;
}): boolean {
  if (!input.purposeIsRegularizacion || input.foreignLang !== "fr" || input.isFrenchCriminalRecord) return false;
  const pages = Number(input.pages);
  return !(Number.isFinite(pages) && pages > REGULARIZACION_MAX_PAGES);
}

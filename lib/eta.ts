type EtaInput = {
  words?: number | null;
  pagesLabel?: string | null;
  langPair?: string | null;
};

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parsePages(pagesLabel?: string | null) {
  if (!pagesLabel) return 0;
  const m = pagesLabel.match(/\d+/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function isCommonPair(langPair?: string | null) {
  if (!langPair) return true;
  const normalized = langPair.toLowerCase();
  const common = ["es", "fr", "en", "de", "it", "pt"];
  const parts = normalized.split("-");
  return parts.every((p) => common.includes(p));
}

export function getHolidaySetFromEnv() {
  const raw = process.env.ETA_HOLIDAYS || "";
  return new Set(
    raw
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
  );
}

export function isBusinessDay(date: Date, holidaySet: Set<string>) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidaySet.has(toYmd(date));
}

export function addBusinessDays(from: Date, days: number, holidaySet: Set<string>) {
  const safeDays = Math.max(0, Math.round(days));
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < safeDays) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d, holidaySet)) added += 1;
  }
  return d;
}

export function getMadridBusinessBaseDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value || "01");
  const day = Number(parts.find((part) => part.type === "day")?.value || "01");
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function suggestEtaBusinessDays(input: EtaInput) {
  const words = Number(input.words || 0);
  const pages = parsePages(input.pagesLabel);

  let days = 2;
  if (words > 0) {
    if (words <= 600) days = 2;
    else if (words <= 1500) days = 3;
    else if (words <= 3000) days = 4;
    else days = 5;
  } else if (pages > 0) {
    if (pages <= 2) days = 2;
    else if (pages <= 5) days = 3;
    else if (pages <= 8) days = 4;
    else days = 5;
  }

  if (pages >= 8) days += 1;
  if (!isCommonPair(input.langPair)) days += 1;

  return Math.max(1, Math.min(days, 10));
}

export function formatEta(date: Date) {
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

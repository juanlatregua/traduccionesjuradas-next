function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getMadridDateParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value || now.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || now.getUTCDate());
  return { year, month, day };
}

function randomUpper4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function generateReference() {
  const { year, month, day } = getMadridDateParts();
  return `TJ-${year}${pad2(month)}${pad2(day)}-${randomUpper4()}`;
}


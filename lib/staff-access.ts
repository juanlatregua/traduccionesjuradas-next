const DEFAULT_STAFF_EMAILS = [
  "juansilva@traduccionesjuradas.net",
  "hola@traduccionesjuradas.net",
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getStaffEmails() {
  const raw = process.env.STAFF_EMAILS || "";
  const extra = raw
    .split(",")
    .map((item) => normalize(item))
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_STAFF_EMAILS.map(normalize), ...extra]));
}

export function isStaffEmail(email?: string | null) {
  if (!email) return false;
  const staff = getStaffEmails();
  return staff.includes(normalize(email));
}

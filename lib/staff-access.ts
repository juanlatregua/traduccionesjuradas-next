const DEFAULT_STAFF_EMAILS = [
  "juansilva@traduccionesjuradas.net",
  "juasilva@traduccionesjuradas.net",
  "hola@traduccionesjuradas.net",
];

const DEFAULT_PM_EMAILS = ["juansilva@traduccionesjuradas.net", "juasilva@traduccionesjuradas.net"];
const DEFAULT_COLLABORATOR_EMAILS = ["juan@gestremor.com"];
const DEFAULT_ADMIN_EMAILS = ["hola@traduccionesjuradas.net"];

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

function getEnvEmailList(envName: string, defaults: string[]) {
  const raw = process.env[envName] || "";
  const parsed = raw
    .split(",")
    .map((item) => normalize(item))
    .filter(Boolean);
  return Array.from(new Set([...defaults.map(normalize), ...parsed]));
}

export function getPmEmails() {
  return getEnvEmailList("PM_EMAILS", DEFAULT_PM_EMAILS);
}

export function getCollaboratorEmails() {
  return getEnvEmailList("COLLABORATOR_EMAILS", DEFAULT_COLLABORATOR_EMAILS);
}

export function getAdminEmails() {
  return getEnvEmailList("ADMIN_EMAILS", DEFAULT_ADMIN_EMAILS);
}

export type StaffRole = "ADMIN" | "PM" | "COLLABORATOR" | "STAFF" | null;

export function getStaffRole(email?: string | null): StaffRole {
  if (!email) return null;
  const normalized = normalize(email);
  if (getCollaboratorEmails().includes(normalized)) return "COLLABORATOR";
  if (!isStaffEmail(normalized)) return null;
  if (getAdminEmails().includes(normalized)) return "ADMIN";
  if (getPmEmails().includes(normalized)) return "PM";
  return "STAFF";
}

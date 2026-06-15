// lib/gsc.ts — Cliente mínimo de la Google Search Console API (Search Analytics)
// con autenticación por service account (JWT RS256 → access token), sin SDK.
// Credenciales: GSC_SERVICE_ACCOUNT_JSON (clave JSON completa) + GSC_SITE_URL
// (p.ej. "sc-domain:traduccionesjuradas.net"). Solo lectura (webmasters.readonly).

import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

type ServiceAccount = { client_email: string; private_key: string };

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GSC_SERVICE_ACCOUNT_JSON no configurada.");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GSC_SERVICE_ACCOUNT_JSON inválida (falta client_email/private_key).");
  }
  return sa;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function getAccessToken(): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now })
  );
  const input = `${header}.${claims}`;
  const signature = b64url(crypto.sign("RSA-SHA256", Buffer.from(input), sa.private_key));
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${input}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`GSC token error: ${JSON.stringify(data.error || data)}`);
  }
  return data.access_token as string;
}

export type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function querySearchAnalytics(params: {
  dimensions: string[];
  startDate: string;
  endDate: string;
  rowLimit?: number;
}): Promise<GscRow[]> {
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) throw new Error("GSC_SITE_URL no configurada.");
  const token = await getAccessToken();
  const res = await fetch(`${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions,
      rowLimit: params.rowLimit ?? 1000,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GSC query error: ${JSON.stringify(data.error || data)}`);
  return (data.rows || []) as GscRow[];
}

// GSC tiene ~3 días de lag de datos. Ventana por defecto: 28 días terminando hoy-3.
export function defaultDateRange(daysBack = 28, lagDays = 3): { startDate: string; endDate: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.now() - lagDays * 86_400_000);
  const start = new Date(end.getTime() - daysBack * 86_400_000);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// scripts/gsc-test-connection.mjs — Probar acceso a Search Console con la SA existente
// Sin dependencias: JWT firmado manualmente + fetch.

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const env = readFileSync(envPath, "utf8");

const match = env.match(/GOOGLE_VISION_SERVICE_ACCOUNT_JSON='([\s\S]+?)'\n/);
if (!match) {
  console.error("No SA JSON found in .env.local");
  process.exit(1);
}
const sa = JSON.parse(match[1]);
console.log(`SA: ${sa.client_email}`);
console.log(`Project: ${sa.project_id}\n`);

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const now = Math.floor(Date.now() / 1000);
const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const claims = base64url(JSON.stringify({
  iss: sa.client_email,
  scope: "https://www.googleapis.com/auth/webmasters.readonly",
  aud: "https://oauth2.googleapis.com/token",
  exp: now + 3600,
  iat: now,
}));
const signingInput = `${header}.${claims}`;
const signer = createSign("RSA-SHA256");
signer.update(signingInput);
const signature = signer.sign(sa.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = `${signingInput}.${signature}`;

// Exchange JWT for access token
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }),
});
const tokenData = await tokenRes.json();
if (!tokenData.access_token) {
  console.error("Token exchange failed:", tokenData);
  process.exit(1);
}
console.log("Access token obtained\n");

// List Search Console sites
const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
  headers: { Authorization: `Bearer ${tokenData.access_token}` },
});
const sitesData = await sitesRes.json();
console.log("Sites response:");
console.log(JSON.stringify(sitesData, null, 2));

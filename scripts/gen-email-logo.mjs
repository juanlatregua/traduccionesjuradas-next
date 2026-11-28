// scripts/gen-email-logo.mjs — PNG del isotipo para la cabecera de los emails (Gmail y Outlook no pintan SVG).
// Mismo trazo que logo-horizontal.svg (T blanca + D dorada), con el fondo de la cabecera horneado.
// Reejecutar tras cambiar el logo: `node scripts/gen-email-logo.mjs`
import sharp from "sharp";
import { resolve } from "node:path";

const W = 92;
const H = 68;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="14 0 242 178">
  <rect x="14" y="0" width="242" height="178" fill="#1A2E4A"/>
  <line x1="40" y1="36" x2="160" y2="36" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
  <line x1="76" y1="36" x2="76" y2="142" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
  <line x1="76" y1="142" x2="160" y2="142" stroke="#B8922A" stroke-width="16" stroke-linecap="round"/>
  <path d="M160,36 Q230,36 230,89 Q230,142 160,142" fill="none" stroke="#B8922A" stroke-width="16" stroke-linecap="round"/>
</svg>`;

const out = resolve(process.cwd(), "public/brand/logo-email.png");
await sharp(Buffer.from(svg), { density: 384 }).resize(W, H).png({ compressionLevel: 9 }).toFile(out);
console.log(`✓ public/brand/logo-email.png (${W}×${H})`);

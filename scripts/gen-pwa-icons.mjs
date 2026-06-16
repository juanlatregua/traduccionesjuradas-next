// scripts/gen-pwa-icons.mjs — Genera los PNG de iconos PWA desde los SVG de marca.
// Reejecutar tras cambiar el logo: `node scripts/gen-pwa-icons.mjs`
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PUB = resolve(process.cwd(), "public");
const appIcon = readFileSync(resolve(PUB, "logo-tj-app.svg")); // esquinas redondeadas, transparente
const maskable = readFileSync(resolve(PUB, "brand/logo-tj-maskable.svg")); // full-bleed (apple + maskable)

const jobs = [
  { src: appIcon, size: 192, out: "icons/icon-192.png" },
  { src: appIcon, size: 512, out: "icons/icon-512.png" },
  { src: maskable, size: 512, out: "icons/icon-maskable-512.png" },
  { src: maskable, size: 180, out: "icons/apple-touch-icon.png" },
];

for (const { src, size, out } of jobs) {
  await sharp(src, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(resolve(PUB, out));
  console.log(`✓ ${out} (${size}×${size})`);
}

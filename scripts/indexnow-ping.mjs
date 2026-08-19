// scripts/indexnow-ping.mjs — avisa a IndexNow (Bing, Yandex, Naver, Seznam, Yep,
// Amazon) de las URLs publicadas o actualizadas. Google NO participa en IndexNow:
// su "Solicitar indexación" en Search Console sigue siendo manual.
//
//   npm run indexnow                              # lastmod de los últimos 7 días
//   npm run indexnow -- --days 30 --dry-run
//   npm run indexnow -- --force
//   npm run indexnow -- https://www.traduccionesjuradas.net/blog/x
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = "https://www.traduccionesjuradas.net";
const SITEMAP_URL = `${BASE}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const STATE_FILE = resolve(__dirname, ".indexnow-sent.json");
const MAX_URLS = 10000;
const DEFAULT_DAYS = 7;

const STATUS_MEANING = {
  200: "OK — URLs aceptadas",
  202: "Aceptado, clave pendiente de validar",
  400: "Formato incorrecto",
  403: "Clave inválida (no coincide con el fichero publicado)",
  422: "Alguna URL no pertenece al host o la clave no coincide",
  429: "Demasiadas peticiones (posible spam) — espera antes de reintentar",
};

function parseArgs(argv) {
  const opts = { days: DEFAULT_DAYS, dryRun: false, force: false, urls: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--days") opts.days = Number(argv[++i]);
    else if (arg.startsWith("--days=")) opts.days = Number(arg.slice(7));
    else if (arg.startsWith("http")) opts.urls.push(arg);
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }
  if (!Number.isFinite(opts.days) || opts.days <= 0) throw new Error("--days debe ser un número de días positivo.");
  return opts;
}

// La clave se deriva del fichero servido en public/, no de una env: es pública por
// diseño del protocolo y un segundo origen de verdad podría desincronizarse.
function resolveKey() {
  const override = process.env.INDEXNOW_KEY?.trim();
  if (override) return { key: override, keyFile: `${BASE}/${override}.txt` };

  const candidates = readdirSync(resolve(ROOT, "public")).filter((f) => /^[a-f0-9]{8,128}\.txt$/i.test(f));
  if (candidates.length !== 1) {
    throw new Error(
      `Se esperaba 1 fichero de clave en public/ y hay ${candidates.length} (${candidates.join(", ") || "ninguno"}).`
    );
  }
  const file = candidates[0];
  const key = basename(file, ".txt");
  const content = readFileSync(resolve(ROOT, "public", file), "utf8").trim();
  if (content !== key) {
    throw new Error(`public/${file} debe contener exactamente "${key}" y contiene "${content}".`);
  }
  return { key, keyFile: `${BASE}/${file}` };
}

async function fetchSitemapUrls(sitemapUrl) {
  const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(20000) }).catch((e) => {
    throw new Error(`No se pudo leer el sitemap (${sitemapUrl}): ${e.message}`);
  });
  if (!res.ok) throw new Error(`El sitemap respondió ${res.status} (${sitemapUrl}).`);
  const xml = await res.text();
  const entries = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) || []) {
    const loc = block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim();
    const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim();
    if (loc) entries.push({ loc, lastmod: lastmod || "" });
  }
  if (entries.length === 0) throw new Error("El sitemap no devolvió ninguna URL.");
  return entries;
}

function selectRecent(entries, days) {
  const cutoff = Date.now() - days * 86400000;
  return entries.filter((e) => {
    const t = Date.parse(e.lastmod);
    return Number.isFinite(t) && t >= cutoff;
  });
}

function loadSent() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    console.warn("⚠ Estado ilegible en scripts/.indexnow-sent.json — se ignora.");
    return {};
  }
}

function saveSent(map) {
  writeFileSync(STATE_FILE, `${JSON.stringify(map, null, 2)}\n`);
}

async function submit(key, keyFile, urls) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(BASE).host,
      key,
      keyLocation: keyFile,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(30000),
  }).catch((e) => {
    throw new Error(`No se pudo contactar con IndexNow (${ENDPOINT}): ${e.message}`);
  });
  return { status: res.status, ok: res.ok, body: (await res.text()).slice(0, 300) };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { key, keyFile } = resolveKey();
  console.log(`Clave: ${key} (${keyFile})`);

  let urls;
  let sent = null;

  if (opts.urls.length > 0) {
    // URLs explícitas: el disparo es deliberado, ni ventana ni estado. Exigimos el
    // origen exacto: otro host da 422, y http:// o el dominio sin www acaban en el
    // 308 a la canónica (el motor rastrearía un redirect en vez de la página).
    const foreign = opts.urls.filter((u) => u !== BASE && !u.startsWith(`${BASE}/`));
    if (foreign.length > 0) throw new Error(`Solo se aceptan URLs de ${BASE}: ${foreign.join(", ")}`);
    urls = opts.urls;
    console.log(`URLs explícitas: ${urls.length}`);
  } else {
    const entries = await fetchSitemapUrls(SITEMAP_URL);
    const recent = selectRecent(entries, opts.days);
    const dias = opts.days === 1 ? "día" : "días";
    console.log(`Sitemap: ${entries.length} URLs · ${recent.length} con lastmod en los últimos ${opts.days} ${dias}`);
    const previous = loadSent();
    const fresh = opts.force ? recent : recent.filter((e) => previous[e.loc] !== e.lastmod);
    const skipped = recent.length - fresh.length;
    if (skipped > 0) console.log(`Se saltan ${skipped} sin cambios desde el último envío.`);
    urls = fresh.map((e) => e.loc);
    sent = { ...previous, ...Object.fromEntries(fresh.map((e) => [e.loc, e.lastmod])) };
  }

  if (urls.length === 0) {
    console.log("Nada que enviar.");
    return;
  }
  if (urls.length > MAX_URLS) throw new Error(`${urls.length} URLs superan el máximo de ${MAX_URLS} por petición.`);

  for (const u of urls) console.log(`  · ${u}`);

  if (opts.dryRun) {
    console.log(`\n[dry-run] No se ha enviado nada. Se enviarían ${urls.length} URL(s) a ${ENDPOINT}.`);
    return;
  }

  const { status, ok, body } = await submit(key, keyFile, urls);
  const meaning = STATUS_MEANING[status] || "Respuesta no documentada";
  console.log(`\nRespuesta de IndexNow: ${status} — ${meaning}${body ? ` · ${body}` : ""}`);
  if (!ok) throw new Error(`Envío rechazado (${status}). El estado no se toca: al reintentar se enviarán las mismas URLs.`);

  if (sent) saveSent(sent);
  console.log(`${urls.length} URLs enviadas. Recuerda: Google no usa IndexNow, sigue haciendo falta Search Console.`);
}

main().catch((err) => {
  console.error(`✖ ${err?.message || err}`);
  process.exitCode = 1;
});

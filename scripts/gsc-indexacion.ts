// Listas diarias de «Solicitar indexación» en Search Console: inspecciona TODO el
// sitemap (sin el tope de 200 s del digest), descarta lo pedido en los últimos
// 10 días y reparte el resto en tandas de 10. La API no permite pedir la
// indexación: el clic lo da Juan; al terminar, `marcar` las anota.
//
//   npx tsx --env-file=.env.local scripts/gsc-indexacion.ts            → listas
//   npx tsx --env-file=.env.local scripts/gsc-indexacion.ts marcar <url>…  → anotar pedidas
//   npx tsx --env-file=.env.local scripts/gsc-indexacion.ts sitemap        → reenviar el sitemap
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const PEDIDAS = "qa/seo/indexacion-pedidas.txt";
const DIAS_SIN_REPETIR = 10;
const POR_DIA = 10;

const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
process.env.GSC_SERVICE_ACCOUNT_JSON ||= env.match(/GOOGLE_VISION_SERVICE_ACCOUNT_JSON='([\s\S]+?)'\n/)?.[1];
process.env.GSC_SITE_URL ||= "sc-domain:traduccionesjuradas.net";

const hoy = new Date().toISOString().slice(0, 10);
mkdirSync("qa/seo", { recursive: true });

function pedidasRecientes(): Set<string> {
  if (!existsSync(PEDIDAS)) return new Set();
  const limite = new Date(Date.now() - DIAS_SIN_REPETIR * 86_400_000).toISOString().slice(0, 10);
  return new Set(
    readFileSync(PEDIDAS, "utf8")
      .split("\n")
      .map((l) => l.trim().split(/\s+/))
      .filter(([fecha, url]) => url && fecha >= limite)
      .map(([, url]) => url)
  );
}

// Orden: canónica ajena → no indexadas (más prioridad de sitemap, luego sin rastrear
// antes que rastreadas) → rastreadas antes de su última modificación.
function peso(estado: string): number {
  if (/no reconoce|unknown/i.test(estado)) return 0;
  if (/Descubierta|Discovered/i.test(estado)) return 1;
  return 2;
}

async function listas() {
  const { getAccessToken, inspectUrl } = await import("@/lib/gsc");
  const sitemap = (await import("@/app/sitemap")).default;
  const entries = sitemap();
  const token = await getAccessToken();
  const yaPedidas = pedidasRecientes();

  type Fila = { url: string; motivo: string; prioridad: number; orden: number };
  const filas: Fila[] = [];
  const errores: string[] = [];
  let i = 0;
  let hechas = 0;

  async function worker() {
    while (i < entries.length) {
      const e = entries[i++];
      const prioridad = typeof e.priority === "number" ? e.priority : 0.5;
      try {
        const r = await inspectUrl(e.url, token);
        hechas++;
        const mod = e.lastModified ? new Date(e.lastModified as any).toISOString().slice(0, 10) : null;
        const rastreo = r.lastCrawlTime?.slice(0, 10) ?? null;
        const ajena = r.googleCanonical && new URL(r.googleCanonical).hostname !== new URL(e.url).hostname;
        if (ajena) filas.push({ url: e.url, motivo: `canónica ajena: ${r.googleCanonical}`, prioridad, orden: -1 });
        else if (r.verdict !== "PASS")
          filas.push({ url: e.url, motivo: `${r.coverageState} (rastreo: ${rastreo ?? "nunca"})`, prioridad, orden: peso(r.coverageState) });
        else if (mod && rastreo && rastreo < mod)
          filas.push({ url: e.url, motivo: `indexada pero rastreada ${rastreo}, modificada ${mod}`, prioridad, orden: 3 });
      } catch (err: any) {
        if (errores.length < 5) errores.push(`${e.url}: ${err?.message || err}`);
      }
      if (hechas % 20 === 0) process.stderr.write(`… ${hechas}/${entries.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));

  const pendientes = filas
    .filter((f) => !yaPedidas.has(f.url))
    .sort((a, b) => a.orden - b.orden || b.prioridad - a.prioridad || a.url.localeCompare(b.url));

  const out = [
    `# Indexación GSC — ${hoy}`,
    `Inspeccionadas ${hechas}/${entries.length} · pendientes ${pendientes.length} · omitidas por pedidas en ${DIAS_SIN_REPETIR} días: ${filas.length - pendientes.length}`,
  ];
  if (errores.length) out.push(`Errores: ${errores.join(" | ")}`);
  for (let d = 0; d * POR_DIA < pendientes.length; d++) {
    out.push("", `## Día ${d + 1}`);
    for (const f of pendientes.slice(d * POR_DIA, (d + 1) * POR_DIA)) out.push(`- ${f.url} — ${f.motivo}`);
  }
  const md = out.join("\n");
  writeFileSync(`qa/seo/indexacion-${hoy}.md`, md + "\n");
  console.log(md);
  console.log(`\nGuardado en qa/seo/indexacion-${hoy}.md`);
}

const [cmd, ...urls] = process.argv.slice(2);
if (cmd === "marcar") {
  if (urls.length === 0) throw new Error("marcar <url>…");
  appendFileSync(PEDIDAS, urls.map((u) => `${hoy} ${u}`).join("\n") + "\n");
  console.log(`Anotadas ${urls.length} como pedidas el ${hoy}.`);
} else if (cmd === "sitemap") {
  import("@/lib/gsc")
    .then(({ submitSitemap }) => submitSitemap("https://www.traduccionesjuradas.net/sitemap.xml"))
    .then(() => console.log("Sitemap reenviado a Search Console."))
    .catch((err) => {
      console.error(err?.message || err);
      process.exit(1);
    });
} else {
  listas().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

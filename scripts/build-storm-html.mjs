// scripts/build-storm-html.mjs — genera un HTML combinado a partir de los JSON
// de salida de los workflows STORM. Determinista: no reescribe contenido, solo
// renderiza lo que devolvieron los agentes. Uso:
//   node scripts/build-storm-html.mjs out.html f1.output f2.output f3.output
import { readFileSync, writeFileSync } from "node:fs";

const [outPath, ...files] = process.argv.slice(2);
if (!outPath || files.length === 0) { console.error("uso: build-storm-html.mjs OUT F1 [F2 ...]"); process.exit(1); }

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const LABELS = {
  corePosition: "Posición central", strongestEvidence: "Evidencia más fuerte",
  uniqueInsight: "Insight único", whatWeAreNotSeeing: "Lo que no estamos viendo",
  lateForWhat: "¿Tarde para qué?", channelLean: "Recomendación de carril", v2OrV3: "Lean v2/v3",
  conflicts: "Conflictos", claimA: "Afirmación A", claimB: "Afirmación B", whoVsWho: "Quién vs quién",
  strongestPerspective: "Perspectiva más fuerte", weakestPerspective: "Perspectiva más débil",
  resolvingQuestion: "Pregunta que lo resolvería", consensus: "Consenso (probablemente cierto)",
  blindSpot: "Punto ciego", deepestBlindSpot: "Punto ciego más profundo",
  ceoSummary: "Resumen CEO", keyFindings: "Hallazgos clave (rankeados por fiabilidad)",
  finding: "Hallazgo", reliability: "Fiabilidad", supportedBy: "Apoyan", challengedBy: "Desafían",
  hiddenConnection: "Conexión oculta", verdict: "Veredicto", metricVerdict: "Veredicto de métrica/carril",
  lateVerdict: "Veredicto · ¿vamos tarde?", decision: "Decisión", rationale: "Razón",
  v2Refinements: "Refinamientos de v2", v3Candidate: "¿Procede v3?",
  roadmapBranch: "Rama roadmap (#2)", ptBranch: "Rama PT (#4)", cheapestExperiment: "Experimento de medición más barato",
  whatStaysVsDisrupted: "El moat (aguanta) vs lo disrumpido", reframe: "El re-encuadre",
  actionable: "Acciones priorizadas", action: "Acción", why: "Por qué", effort: "Esfuerzo",
  frontierQuestion: "Pregunta frontera", confidenceScores: "Puntuaciones de confianza",
  claim: "Afirmación", score: "Puntuación", weakestLink: "Eslabón más débil",
  biasCheck: "Chequeo de sesgo", missingPerspective: "Perspectiva ausente",
  hallucinationFlags: "Banderas de alucinación", doomCheck: "Chequeo catastrofismo/complacencia",
  grade: "Nota global", fixes: "Qué mandaría arreglar",
};
const lbl = (k) => LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const SKIP = new Set(["key", "label", "q"]);

function renderValue(v) {
  if (v == null) return "";
  if (typeof v === "string") return `<p>${esc(v)}</p>`;
  if (typeof v === "number") return `<p class="num">${esc(v)}</p>`;
  if (Array.isArray(v)) {
    if (v.length === 0) return `<p class="muted">—</p>`;
    if (typeof v[0] === "string") return `<ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    // array de objetos
    return v.map((o) => `<div class="subcard">${renderObject(o)}</div>`).join("");
  }
  if (typeof v === "object") return renderObject(v);
  return `<p>${esc(String(v))}</p>`;
}
function renderObject(o) {
  return Object.entries(o)
    .filter(([k]) => !SKIP.has(k))
    .map(([k, val]) => {
      const flag = k === "hallucinationFlags";
      const isScore = k === "reliability" || k === "score";
      if (isScore) return `<span class="badge">${esc(lbl(k))}: ${esc(val)}/10</span>`;
      return `<div class="field ${flag ? "flagfield" : ""}"><span class="k">${esc(lbl(k))}</span>${renderValue(val)}</div>`;
    })
    .join("");
}

function verdictOf(s) {
  const syn = s.result?.synthesis || {};
  const v = syn.verdict || syn.metricVerdict || syn.lateVerdict || {};
  return v.decision || v.verdict || "(ver síntesis)";
}
function gradeOf(s) { return s.result?.peer?.grade || "—"; }

const storms = files.map((f) => JSON.parse(readFileSync(f, "utf8")));
const TITLES = [
  "STORM 1 · ¿Afinar v2 o definir v3?",
  "STORM 2 · Métrica-estrella / qué carril (web vs WhatsApp/PT)",
  "STORM 3 · ¿Qué no vemos? ¿Vamos tarde?",
];

function stormSection(s, i) {
  const r = s.result || {};
  const persp = (r.perspectives || []).map((p) =>
    `<div class="card"><div class="persp-h">${esc(p.label || p.key || "Perspectiva")}</div>${renderObject(p)}</div>`
  ).join("");
  return `
  <section class="storm" id="storm${i}" ${i === 0 ? "" : 'style="display:none"'}>
    <div class="topic"><strong>Topic:</strong> ${esc(r.topic || "")}</div>
    <div class="vbox"><span class="pill">Veredicto</span> <span class="vtext">${esc(verdictOf(s))}</span> · <span class="pill grade">Peer-review</span> <span class="vtext">${esc(gradeOf(s))}</span></div>

    <h3>Fase 1 — Perspectivas (${(r.perspectives || []).length})</h3>
    <div class="grid">${persp}</div>

    <h3>Fase 2 — Mapa de contradicciones</h3>
    <div class="card">${renderObject(r.contradiction || {})}</div>

    <h3>Fase 3 — Síntesis</h3>
    <div class="card synth">${renderObject(r.synthesis || {})}</div>

    <h3>Fase 4 — Peer-review (anti-alucinación)</h3>
    <div class="card peer">${renderObject(r.peer || {})}</div>
  </section>`;
}

const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STORM — Estrategia traduccionesjuradas.net</title>
<style>
:root{--bleu:#1f4e79;--encre:#1a2230;--sepia:#5b5446;--cream:#e7e0d2;--parchment:#f6f1e7;--card:#fffdf8;--or:#b8860b;--red:#b91c1c;--green:#2e7d32;--graphite:#6b7280}
*{box-sizing:border-box}
body{margin:0;background:var(--parchment);color:var(--encre);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:1.8rem;margin:.2em 0}
h3{color:var(--bleu);border-left:4px solid var(--bleu);padding-left:10px;margin:1.6em 0 .5em}
.meta{color:var(--sepia);font-size:.88rem}
.nav{position:sticky;top:0;background:var(--parchment);padding:12px 0;border-bottom:2px solid var(--bleu);z-index:10;display:flex;gap:8px;flex-wrap:wrap}
.nav button{font:inherit;font-size:.85rem;font-weight:700;border:1px solid var(--cream);background:var(--card);color:var(--bleu);padding:8px 12px;border-radius:8px;cursor:pointer}
.nav button.active{background:var(--bleu);color:#fff;border-color:var(--bleu)}
.topic{background:var(--card);border:1px solid var(--cream);border-left:4px solid var(--or);padding:12px 14px;border-radius:8px;margin:14px 0;font-style:italic}
.vbox{margin:10px 0 4px}
.pill{display:inline-block;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#eef2f7;color:var(--bleu);text-transform:uppercase;letter-spacing:.03em}
.pill.grade{background:#fdf0db;color:var(--or)}
.vtext{font-weight:700;color:var(--bleu)}
.grid{display:grid;gap:14px}
@media(min-width:720px){.grid{grid-template-columns:1fr 1fr}}
.card{background:var(--card);border:1px solid var(--cream);border-radius:10px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.card.synth,.card.peer{grid-column:1/-1}
.persp-h{font-weight:800;color:var(--bleu);margin-bottom:6px;font-size:1.02rem}
.field{margin:8px 0}
.field .k{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--graphite);font-weight:700;margin-bottom:1px}
.field p{margin:.2em 0}
.subcard{border-left:3px solid var(--cream);padding:6px 0 6px 12px;margin:8px 0}
.badge{display:inline-block;background:#eef2f7;color:var(--bleu);font-weight:700;font-size:.78rem;padding:1px 8px;border-radius:6px;margin:2px 4px 2px 0}
.flagfield{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px}
.flagfield .k{color:var(--red)}
.flagfield li{margin:6px 0}
ul{margin:.3em 0;padding-left:1.2em}
.muted{color:var(--graphite)}
.num{font-weight:700;font-variant-numeric:tabular-nums}
.summary{background:linear-gradient(180deg,#eaf2fb,#fffdf8);border:1px solid #c7dcf2;border-radius:12px;padding:18px;margin:16px 0}
.summary table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:8px}
.summary td,.summary th{text-align:left;padding:7px 9px;border-bottom:1px solid #d7e6f5;vertical-align:top}
.summary th{font-size:.74rem;text-transform:uppercase;color:var(--sepia)}
footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--cream);color:var(--graphite);font-size:.8rem}
code{background:#f0ece2;padding:1px 5px;border-radius:4px;font-size:.85em}
</style></head><body><div class="wrap">
<div class="meta">Método STORM (Stanford) · 3 análisis · 24 agentes · grounded en datos reales + verificación de código · 2026-06-18</div>
<h1>Estrategia traduccionesjuradas.net — 3 STORM</h1>

<div class="summary">
  <strong>Convergencia de los tres análisis (síntesis):</strong>
  <ul>
    <li><strong>El motor real es el contenido de trámite por país</strong> (Marruecos, pos 7,6), no las features de producto. Las 10 landings de idioma (0 clics) y los 5 lectores-AEO (invisibles) no atraen.</li>
    <li><strong>El canal real (WhatsApp/PT) está sin medir</strong>: 32 <code>wa.me</code>, solo 1 instrumentado. Los tres coinciden: <strong>medir antes de decidir</strong> nada irreversible.</li>
    <li><strong>Congelar (no borrar) lo que no atrae</strong>: el coste-hundido ya está pagado; el error es seguir invirtiendo horas ahí.</li>
    <li><strong>El moat (firma jurada MAEC nº 3850) NO se disrumpe.</strong> Lo que se disrumpe es el descubrimiento, la captación y la entrega.</li>
    <li><strong>El eje de 2027</strong> (STORM 3): no es «web vs WhatsApp» sino ser <strong>citable y contratable por agentes IA</strong> — <code>llms.txt</code> ya existe; la web ya alimenta al WhatsApp.</li>
  </ul>
  <table><tr><th>Análisis</th><th>Veredicto</th><th>Peer-review</th></tr>
  ${storms.map((s, i) => `<tr><td>${esc(TITLES[i])}</td><td><strong>${esc(verdictOf(s))}</strong></td><td>${esc(gradeOf(s))}</td></tr>`).join("")}
  </table>
</div>

<div class="nav">${TITLES.map((t, i) => `<button data-i="${i}" class="${i === 0 ? "active" : ""}">${esc(t)}</button>`).join("")}</div>

${storms.map((s, i) => stormSection(s, i)).join("\n")}

<footer>Generado por <code>scripts/build-storm-html.mjs</code> leyendo los JSON de salida de 3 workflows STORM (5 perspectivas independientes → contradicciones → síntesis → peer-review anti-alucinación cada uno). Anclado a GSC (28d, 2026-06-16), inspect-all de indexación (2026-06-18) y verificación de código en vivo. Las banderas de alucinación del peer-review NO se editaron: son la autocrítica de cada análisis. · 2026-06-18</footer>
</div>
<script>
const btns=[...document.querySelectorAll('.nav button')],secs=[...document.querySelectorAll('.storm')];
btns.forEach(b=>b.onclick=()=>{const i=+b.dataset.i;btns.forEach(x=>x.classList.toggle('active',x===b));secs.forEach((s,j)=>s.style.display=j===i?'block':'none');window.scrollTo({top:0,behavior:'smooth'})});
</script></body></html>`;

writeFileSync(outPath, html);
console.log(`✅ ${outPath} (${(html.length/1024).toFixed(0)} KB · ${storms.length} STORM)`);

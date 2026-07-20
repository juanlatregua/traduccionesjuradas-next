// scripts/build-storm-fused-html.mjs — HTML fundido: briefing unificado (de la
// meta-sintesis) como documento principal + las 3 STORM como anexos. Determinista.
// uso: node build-storm-fused-html.mjs OUT FUSION.output S1 S2 S3
import { readFileSync, writeFileSync } from "node:fs";
const [outPath, fusionFile, ...stormFiles] = process.argv.slice(2);

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const F = JSON.parse(readFileSync(fusionFile, "utf8")).result;
const fus = F.fusion, ver = F.verify;

// ---- renderer generico (para anexos) ----
const LABELS = { corePosition:"Posición central", strongestEvidence:"Evidencia más fuerte", uniqueInsight:"Insight único", whatWeAreNotSeeing:"Lo que no vemos", lateForWhat:"¿Tarde para qué?", channelLean:"Recomendación de carril", v2OrV3:"Lean v2/v3", conflicts:"Conflictos", claimA:"Afirmación A", claimB:"Afirmación B", whoVsWho:"Quién vs quién", strongestPerspective:"Perspectiva más fuerte", weakestPerspective:"Perspectiva más débil", resolvingQuestion:"Pregunta que lo resolvería", consensus:"Consenso", blindSpot:"Punto ciego", deepestBlindSpot:"Punto ciego más profundo", ceoSummary:"Resumen CEO", keyFindings:"Hallazgos clave", finding:"Hallazgo", reliability:"Fiabilidad", supportedBy:"Apoyan", challengedBy:"Desafían", hiddenConnection:"Conexión oculta", verdict:"Veredicto", metricVerdict:"Veredicto métrica/carril", lateVerdict:"Veredicto ¿tarde?", decision:"Decisión", rationale:"Razón", v2Refinements:"Refinamientos de v2", v3Candidate:"¿Procede v3?", roadmapBranch:"Rama roadmap", ptBranch:"Rama PT", cheapestExperiment:"Experimento más barato", whatStaysVsDisrupted:"Moat vs disrumpido", reframe:"Re-encuadre", actionable:"Acciones", action:"Acción", why:"Por qué", effort:"Esfuerzo", frontierQuestion:"Pregunta frontera", confidenceScores:"Confianza", claim:"Afirmación", score:"Puntuación", weakestLink:"Eslabón más débil", biasCheck:"Sesgo", missingPerspective:"Perspectiva ausente", hallucinationFlags:"Banderas de alucinación", doomCheck:"Catastrofismo/complacencia", grade:"Nota", fixes:"Arreglar" };
const lbl = (k) => LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const SKIP = new Set(["key", "label", "q"]);
function rv(v) {
  if (v == null) return "";
  if (typeof v === "string") return `<p>${esc(v)}</p>`;
  if (typeof v === "number") return `<p>${esc(v)}</p>`;
  if (Array.isArray(v)) { if (!v.length) return ""; return typeof v[0] === "string" ? `<ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : v.map((o) => `<div class="subcard">${ro(o)}</div>`).join(""); }
  if (typeof v === "object") return ro(v);
  return `<p>${esc(String(v))}</p>`;
}
function ro(o) {
  return Object.entries(o).filter(([k]) => !SKIP.has(k)).map(([k, val]) => {
    if (k === "reliability" || k === "score") return `<span class="badge">${esc(lbl(k))}: ${esc(val)}/10</span>`;
    const flag = k === "hallucinationFlags";
    return `<div class="field ${flag ? "flag" : ""}"><span class="k">${esc(lbl(k))}</span>${rv(val)}</div>`;
  }).join("");
}

// ---- anexos ----
const ANEXO_TITLES = ["A · ¿Afinar v2 o v3?", "B · Métrica/carril (web vs WhatsApp/PT)", "C · ¿Qué no vemos? ¿Vamos tarde?"];
function anexo(file, i) {
  const r = JSON.parse(readFileSync(file, "utf8")).result;
  const persp = (r.perspectives || []).map((p) => `<div class="card"><div class="ph">${esc(p.label || p.key)}</div>${ro(p)}</div>`).join("");
  return `<details class="anexo"><summary><strong>Anexo ${esc(ANEXO_TITLES[i])}</strong> — STORM completa (5 perspectivas + contradicciones + síntesis + peer-review)</summary>
    <div class="topic">${esc(r.topic)}</div>
    <h4>Perspectivas</h4><div class="grid">${persp}</div>
    <h4>Contradicciones</h4><div class="card">${ro(r.contradiction || {})}</div>
    <h4>Síntesis</h4><div class="card">${ro(r.synthesis || {})}</div>
    <h4>Peer-review</h4><div class="card">${ro(r.peer || {})}</div>
  </details>`;
}

const conv = (fus.convergences || []).map((c) => `<div class="conv"><span class="cf ${c.confidence === "alta" ? "hi" : "mid"}">${esc(c.confidence)}</span><p>${esc(c.point)}</p><span class="src">${esc(c.fromStorms)}</span></div>`).join("");
const tens = (fus.tensions || []).map((t) => `<div class="tension"><p class="t"><strong>⚡ ${esc(t.tension)}</strong></p><p class="r">→ ${esc(t.resolution)}</p></div>`).join("");
const ladder = (fus.actionLadder || []).sort((a, b) => a.rank - b.rank).map((a) => `<tr><td class="num">${esc(a.rank)}</td><td><strong>${esc(a.action)}</strong><br><span class="muted">${esc(a.why)}</span></td><td>${esc(a.effort)}</td><td>${esc(a.reversibility)}</td></tr>`).join("");
const risks = (fus.openRisks || []).map((r) => `<li><strong>${esc(r.risk)}</strong> — ${esc(r.why)}</li>`).join("");
const notdo = (fus.whatNotToDo || []).map((x) => `<li>${esc(x)}</li>`).join("");
const verFlags = [...(ver.overclaimFlags || []), ...(ver.unsupported || [])];
const verPanel = `<div class="flag-panel"><strong>Verificación (anti-sobreinterpretación) · nota ${esc(ver.grade || "—")}</strong>
  ${verFlags.length ? `<p class="muted">Afirmaciones más fuertes que sus fuentes / no respaldadas:</p><ul>${verFlags.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="ok">Sin sobreinterpretaciones: la fusión no afirma nada por encima de las 3 fuentes.</p>`}
  ${(ver.missingFromFusion || []).length ? `<p class="muted">Reincorporado de las fuentes (no se omite):</p><ul>${ver.missingFromFusion.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>`;

const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STORM fundida — Estrategia traduccionesjuradas.net</title><style>
:root{--bleu:#1f4e79;--encre:#1a2230;--sepia:#5b5446;--cream:#e7e0d2;--parchment:#f6f1e7;--card:#fffdf8;--or:#b8860b;--red:#b91c1c;--green:#2e7d32;--graphite:#6b7280}
*{box-sizing:border-box}body{margin:0;background:var(--parchment);color:var(--encre);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:1.95rem;margin:.1em 0;letter-spacing:-.01em}h2{font-size:1.3rem;color:var(--bleu);border-left:4px solid var(--bleu);padding-left:10px;margin:1.8em 0 .5em}
h4{color:var(--bleu);margin:1.2em 0 .4em}.meta{color:var(--sepia);font-size:.88rem}
.exec{background:linear-gradient(180deg,#eaf2fb,#fffdf8);border:1px solid #c7dcf2;border-radius:12px;padding:20px;margin:16px 0;font-size:1.02rem}
.reframe{background:#fff8ec;border:1px solid #f3d9a4;border-left:5px solid var(--or);border-radius:10px;padding:18px;margin:18px 0;font-size:1.05rem}
.bottom{background:var(--encre);color:#fdf6e8;border-radius:12px;padding:18px 20px;margin:20px 0;font-size:1.1rem;font-weight:600}
.conv{background:var(--card);border:1px solid var(--cream);border-radius:9px;padding:12px 14px;margin:8px 0}
.conv .cf{display:inline-block;font-size:.68rem;font-weight:800;text-transform:uppercase;padding:1px 7px;border-radius:999px;margin-bottom:4px}
.cf.hi{background:#e3f2e4;color:var(--green)}.cf.mid{background:#fdf0db;color:var(--or)}
.conv p{margin:.2em 0}.conv .src{font-size:.78rem;color:var(--graphite)}
.tension{border-left:3px solid var(--red);padding:4px 0 4px 12px;margin:12px 0}.tension .t{margin:.2em 0}.tension .r{margin:.2em 0;color:var(--sepia)}
table{width:100%;border-collapse:collapse;font-size:.92rem;margin:8px 0}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--cream);vertical-align:top}
th{background:#f0ece2;font-size:.74rem;text-transform:uppercase;color:var(--sepia)}.num{font-weight:800;color:var(--bleu)}
.onenum{background:#eef6ff;border:1px solid #bcd9f5;border-radius:10px;padding:16px;margin:14px 0;font-size:1.02rem}
.flag-panel{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin:18px 0}
.flag-panel ul{margin:.3em 0}.muted{color:var(--graphite)}.ok{color:var(--green);font-weight:600}
.risk{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin:12px 0}
.anexo{background:var(--card);border:1px solid var(--cream);border-radius:10px;padding:10px 14px;margin:12px 0}
.anexo summary{cursor:pointer;color:var(--bleu);font-size:.95rem}.anexo .topic{font-style:italic;margin:10px 0;color:var(--sepia)}
.grid{display:grid;gap:12px}@media(min-width:720px){.grid{grid-template-columns:1fr 1fr}}
.card{background:#fff;border:1px solid var(--cream);border-radius:9px;padding:12px 14px}.ph{font-weight:800;color:var(--bleu);margin-bottom:4px}
.field{margin:7px 0}.field .k{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em;color:var(--graphite);font-weight:700}
.field.flag{background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:7px 9px}.field.flag .k{color:var(--red)}
.subcard{border-left:3px solid var(--cream);padding-left:10px;margin:6px 0}.badge{display:inline-block;background:#eef2f7;color:var(--bleu);font-weight:700;font-size:.76rem;padding:1px 7px;border-radius:6px;margin:2px 4px 2px 0}
.topic{background:var(--card);border:1px solid var(--cream);border-left:4px solid var(--or);padding:10px 12px;border-radius:8px;font-style:italic}
footer{margin-top:36px;padding-top:14px;border-top:1px solid var(--cream);color:var(--graphite);font-size:.8rem}code{background:#f0ece2;padding:1px 5px;border-radius:4px;font-size:.85em}
</style></head><body><div class="wrap">
<div class="meta">Meta-síntesis de 3 STORM (Stanford) · 26 agentes en total · grounded + verificado contra código · 2026-06-18</div>
<h1>Estrategia traduccionesjuradas.net — briefing fundido</h1>

<div class="exec">${esc(fus.executiveSummary)}</div>

<div class="reframe"><strong>El re-encuadre:</strong> ${esc(fus.theReframe)}</div>

<h2>En qué convergen las 3 (alta confianza)</h2>
${conv}

<h2>Dónde discrepan — y qué lo decide</h2>
${tens}

<h2>Escalera de acción</h2>
<table><tr><th>#</th><th>Acción · por qué</th><th>Esfuerzo</th><th>Reversibilidad</th></tr>${ladder}</table>

<h2>La cifra que arbitra todo</h2>
<div class="onenum">${esc(fus.theOneNumber)}</div>

<h2>Riesgos abiertos (honestidad)</h2>
<div class="risk"><ul>${risks}</ul></div>

<h2>Qué NO hacer</h2>
<ul>${notdo}</ul>

<div class="bottom">${esc(fus.bottomLine)}</div>

${verPanel}

<h2>Anexos — las 3 STORM completas</h2>
${stormFiles.map((f, i) => anexo(f, i)).join("\n")}

<footer>Briefing fundido por <code>scripts/build-storm-fused-html.mjs</code> a partir de la meta-síntesis (workflow storm-fusion) + verificación anti-sobreinterpretación, sobre 3 STORM previas (24 agentes). Anclado a GSC, inspect-all y verificación de código en vivo. La verificación NO se editó. · 2026-06-18</footer>
</div></body></html>`;

writeFileSync(outPath, html);
console.log(`✅ ${outPath} (${(html.length / 1024).toFixed(0)} KB)`);

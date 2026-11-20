// lib/contador/flow.ts — Orquestación del contador con dependencias inyectadas
// (BD, cliente HTTP, avisos): envío tras el análisis, aplicación idempotente del
// resultado (callback, cron o pantalla de staff) y cron de respaldo.
// La conexión real (Prisma, fetch, email+SMS) vive en lib/contador/server.ts.

import {
  CONTADOR_CALLBACK_URL,
  GIVE_UP_MS,
  applyCounterToAnalysis,
  cronAction,
  isPublicHttpsUrl,
  PUBLIC_DAILY_PER_EMAIL,
  quoteImpact,
  shouldCount,
  type ContadorClient,
  type ContadorJob,
  type QuoteRef,
} from "./core.ts";
import { imageEligibility } from "./image.ts";

export type TrabajoRow = {
  id: string;
  documentAnalysisId: string;
  jobId: string | null;
  estado: string;
  intentos: number;
  paginasHechas: number | null;
  paginasTotal: number | null;
  palabrasTotal: number | null;
  palabrasPorPagina: number[];
  paginasSinTexto: number[];
  palabrasHaiku: number | null;
  aplicadoAt: Date | null;
  abandonadoAt: Date | null;
  avisoJson: any;
  createdAt: Date;
  updatedAt: Date;
};

export type DocRow = {
  id: string;
  fileUrl: string;
  mimeType: string;
  analysisJson: any;
  orderId: string | null;
  orderReference: string | null;
};

// Pedido u OrderSession de la puerta que ya muestran/cobran un precio calculado con Haiku.
export type SaleRef = { kind: "pedido" | "sesion"; reference: string; status: string };

export type ContadorRepo = {
  findTrabajoByDoc(documentAnalysisId: string): Promise<TrabajoRow | null>;
  findTrabajoByJobId(jobId: string): Promise<TrabajoRow | null>;
  createTrabajo(data: { documentAnalysisId: string; palabrasHaiku: number | null }): Promise<TrabajoRow | null>;
  // Solo si el trabajo sigue vivo (aplicadoAt null y estado no terminal): el estado nunca retrocede.
  updateTrabajo(id: string, data: Record<string, unknown>): Promise<boolean>;
  // Vivos + sin_confirmar ya caducados (solo para abandonarlos).
  listPending(limit: number, now: Date): Promise<TrabajoRow[]>;
  countForEmailSince(email: string, since: Date): Promise<number>;
  loadDoc(documentAnalysisId: string): Promise<DocRow | null>;
  quotesForFile(fileUrl: string): Promise<QuoteRef[]>;
  salesForDoc(doc: DocRow): Promise<SaleRef[]>;
  // Marca aplicadoAt (solo si sigue null) y, si se da, anota el analysisJson en la misma transacción. false = ya hecho.
  claim(trabajoId: string, trabajoData: Record<string, unknown>, doc: { id: string; analysisJson: any } | null): Promise<boolean>;
  saveDocAnalysis(docId: string, analysisJson: any): Promise<void>;
};

export type ContadorDeps = {
  client: ContadorClient | null; // null = contador inactivo (flag apagado o faltan variables)
  repo: ContadorRepo;
  alertStaff: (msg: { subject: string; text: string; sms: string; context: string }) => Promise<void>;
  now?: () => number;
  log?: (...args: unknown[]) => void;
};

const SITE = "https://www.traduccionesjuradas.net";
const TERMINAL = new Set(["hecho", "error", "abandonado"]);
export const CRON_BUDGET_MS = 90_000;

async function sendJob(deps: ContadorDeps, t: TrabajoRow, fileUrl: string): Promise<void> {
  const r = await deps.client!.submit({ url: fileUrl, referencia: t.documentAnalysisId, callbackUrl: CONTADOR_CALLBACK_URL });
  if (r.ok) {
    await deps.repo.updateTrabajo(t.id, { jobId: r.id, estado: r.estado, intentos: t.intentos + 1, ultimoError: null });
  } else if (r.ambiguous) {
    await deps.repo.updateTrabajo(t.id, { estado: "sin_confirmar", intentos: t.intentos + 1, ultimoError: r.error });
  } else if (r.retry) {
    await deps.repo.updateTrabajo(t.id, { intentos: t.intentos + 1, ultimoError: r.error });
  } else {
    await deps.repo.updateTrabajo(t.id, { estado: "error", intentos: t.intentos + 1, ultimoError: r.error, motivoError: r.error, abandonadoAt: new Date((deps.now ?? Date.now)()) });
  }
}

/**
 * Tras guardar la cifra de Haiku: encarga el conteo. Staff: envía ya (≤5 s de
 * timeout). Pública: solo encola (pendiente_envio) y el cron lo manda; la ruta
 * pública no espera nada del contador. Nunca lanza.
 */
export async function submitForDocument(
  deps: ContadorDeps,
  doc: { id: string; fileUrl: string; mimeType: string; mode?: string; pageCount?: number | null; analysisJson: any; bytes?: Buffer },
  origin: { kind: "staff" } | { kind: "public"; clientEmail: string | null } = { kind: "staff" }
): Promise<{ submitted: boolean; queued?: boolean; reason?: string }> {
  try {
    if (!deps.client) return { submitted: false, reason: "inactivo" };
    if (!shouldCount(doc)) return { submitted: false, reason: "no_escaneado" };
    if (doc.mimeType !== "application/pdf") {
      const img = imageEligibility(doc.bytes);
      if (!img.ok) return { submitted: false, reason: img.reason }; // HEIC, >20 Mpx o desconocido: se queda Haiku
    }
    if (!isPublicHttpsUrl(doc.fileUrl)) return { submitted: false, reason: "url_no_publica" };
    const existing = await deps.repo.findTrabajoByDoc(doc.id);
    if (existing) {
      // Se volvió a analizar: la cifra ya contada se vuelve a anotar (mismas claves, sin avisos).
      if (existing.estado === "hecho" && existing.aplicadoAt) await reapplyStored(deps, existing);
      return { submitted: false, reason: "existente" };
    }
    if (doc.analysisJson?.words_contador != null) return { submitted: false, reason: "ya_contado" };
    if (origin.kind === "public") {
      const email = (origin.clientEmail || "").trim().toLowerCase();
      if (!email) return { submitted: false, reason: "sin_email" };
      const since = new Date((deps.now ?? Date.now)() - 24 * 3600_000);
      if ((await deps.repo.countForEmailSince(email, since)) >= PUBLIC_DAILY_PER_EMAIL) return { submitted: false, reason: "cupo_email" };
    }
    const created = await deps.repo.createTrabajo({
      documentAnalysisId: doc.id,
      palabrasHaiku: doc.analysisJson?.document_metrics?.estimated_words ?? null,
    });
    if (!created) return { submitted: false, reason: "existente" };
    if (origin.kind === "public") return { submitted: false, queued: true };
    await sendJob(deps, created, doc.fileUrl);
    return { submitted: true };
  } catch (err: any) {
    (deps.log ?? console.error)("[contador] envío falló (el análisis sigue con Haiku):", err?.message || err);
    return { submitted: false, reason: "error" };
  }
}

function jobFromRow(t: TrabajoRow): ContadorJob {
  return {
    id: t.jobId || "",
    estado: "hecho",
    paginas_hechas: t.paginasHechas || 0,
    paginas_total: t.paginasTotal || 0,
    palabras_total: t.palabrasTotal || 0,
    palabras_por_pagina: t.palabrasPorPagina,
    paginas_sin_texto: t.paginasSinTexto,
    idioma_detectado: null,
    motivo_error: null,
    referencia: t.documentAnalysisId,
  };
}

async function reapplyStored(deps: ContadorDeps, t: TrabajoRow): Promise<void> {
  const doc = await deps.repo.loadDoc(t.documentAnalysisId);
  if (!doc) return;
  const out = applyCounterToAnalysis(doc.analysisJson, jobFromRow(t), { image: doc.mimeType !== "application/pdf" });
  if (out.applied) await deps.repo.saveDocAnalysis(t.documentAnalysisId, out.json);
}

export type ProcessResult = "actualizado" | "aplicado" | "anotado_tardio" | "ya_aplicado" | "ya_cerrado" | "no_aplicable" | "error_registrado";

/**
 * Estado nuevo del contador (callback o cron). Idempotente: la cifra se anota una sola vez.
 * Tardío (llega tras abandono/error): solo se guarda en ContadorTrabajo y se avisa; el análisis no se toca.
 */
export async function processJobUpdate(deps: ContadorDeps, t: TrabajoRow, job: ContadorJob): Promise<ProcessResult> {
  if (t.aplicadoAt) return "ya_aplicado";
  const late = TERMINAL.has(t.estado);
  const progress = {
    estado: job.estado,
    paginasHechas: job.paginas_hechas,
    paginasTotal: job.paginas_total,
    palabrasTotal: job.palabras_total,
    palabrasPorPagina: job.palabras_por_pagina,
    paginasSinTexto: job.paginas_sin_texto,
    idiomaDetectado: job.idioma_detectado,
    motivoError: job.motivo_error,
  };
  if (job.estado !== "hecho") {
    if (late) return "ya_cerrado";
    if (job.estado === "error") {
      await deps.repo.updateTrabajo(t.id, { ...progress, abandonadoAt: new Date((deps.now ?? Date.now)()) });
      return "error_registrado";
    }
    await deps.repo.updateTrabajo(t.id, progress);
    return "actualizado";
  }

  const doc = await deps.repo.loadDoc(t.documentAnalysisId);
  const out = doc
    ? applyCounterToAnalysis(doc.analysisJson, job, { image: doc.mimeType !== "application/pdf" })
    : ({ applied: false, reason: "analisis_no_aplicable" } as const);
  if (!doc || !out.applied) {
    const reason = out.applied ? "" : out.reason;
    if (!late) await deps.repo.updateTrabajo(t.id, { ...progress, motivoError: `no aplicado: ${reason}` });
    return "no_aplicable";
  }

  const quotes = await deps.repo.quotesForFile(doc.fileUrl);
  const impact = quoteImpact(out.haikuWords, out.counterWords, quotes);
  const sales = impact.differs ? await deps.repo.salesForDoc(doc) : [];
  const aviso = {
    haiku: out.haikuWords,
    contador: out.counterWords,
    diffPct: impact.diffPct,
    differs: impact.differs,
    tardio: late,
    enviados: impact.alertQuotes,
    borradores: impact.draftQuotes,
    ventas: sales,
  };
  const affectedIds = [...impact.alertQuotes, ...impact.draftQuotes].map((q) => q.id);

  // El rastro (avisoJson) se guarda ANTES de enviar el aviso, en la misma transacción que la anotación.
  const claimed = await deps.repo.claim(
    t.id,
    {
      ...progress,
      ...(late ? { estado: t.estado } : {}),
      palabrasHaiku: out.haikuWords,
      aplicadoAt: new Date((deps.now ?? Date.now)()),
      avisoJson: aviso,
      avisoQuoteIds: affectedIds,
    },
    late ? null : { id: doc.id, analysisJson: out.json }
  );
  if (!claimed) return "ya_aplicado";

  if (impact.differs && (impact.alertQuotes.length > 0 || sales.length > 0)) {
    const lines = [
      `El contador de TraduCAT ha contado ${out.counterWords} palabras en un escaneado; el precio se calculó con la cifra provisional de Haiku: ${out.haikuWords} (${impact.diffPct} % de diferencia).`,
      ...(late ? ["El resultado llegó después de abandonar el trabajo: solo queda anotado, no se ha aplicado."] : []),
      "",
      "El precio NO se ha cambiado. Decide tú si se corrige o se mantiene.",
      "",
      ...impact.alertQuotes.map((q) => `Presupuesto ${q.quoteNumber} (${q.status}): ${SITE}/zona-traductor/presupuestos/${q.id}`),
      ...sales.map((v) =>
        v.kind === "pedido"
          ? `Pedido ${v.reference} (${v.status}): ${SITE}/zona-traductor/pedido/${v.reference}`
          : `Sesión de la puerta ${v.reference} (${v.status}): el cliente ve o paga el precio de Haiku`
      ),
      ...(impact.draftQuotes.length ? ["", `Borradores con el mismo documento: ${impact.draftQuotes.map((q) => q.quoteNumber).join(", ")}`] : []),
      "",
      `Documento: ${doc.id}`,
    ];
    const first = impact.alertQuotes[0]?.quoteNumber || sales[0]?.reference || doc.id;
    await deps
      .alertStaff({
        subject: `⚠ Palabras: contador ${out.counterWords} vs Haiku ${out.haikuWords} en ${first}`,
        text: lines.join("\n"),
        sms: `TraduccionesJuradas: ${first} contador ${out.counterWords} palabras vs ${out.haikuWords} presupuestadas (${impact.diffPct}%). Precio sin tocar. Mira el email.`,
        context: `contador_palabras ${sales.find((v) => v.kind === "pedido")?.reference || first}`,
      })
      .catch((err) => (deps.log ?? console.error)("[contador] aviso a staff falló:", err));
  }
  return late ? "anotado_tardio" : "aplicado";
}

/** Cron de respaldo (cada 2 min): reenvía, consulta o se rinde. Con tope por pasada. */
export async function runContadorCron(deps: ContadorDeps, opts: { limit?: number; budgetMs?: number } = {}) {
  const res = { revisados: 0, enviados: 0, consultados: 0, aplicados: 0, abandonados: 0 };
  if (!deps.client) return res;
  const clock = deps.now ?? Date.now;
  const now = clock();
  const pending = await deps.repo.listPending(opts.limit ?? 20, new Date(now));
  for (const t of pending) {
    if (clock() - now > (opts.budgetMs ?? CRON_BUDGET_MS)) break;
    res.revisados++;
    try {
      const action = cronAction(t, now);
      if (action === "abandonar") {
        const agotado = now - t.createdAt.getTime() <= GIVE_UP_MS;
        await deps.repo.updateTrabajo(t.id, {
          estado: "abandonado",
          abandonadoAt: new Date(now),
          ultimoError: agotado ? `${t.intentos} envíos sin éxito: se queda la cifra de Haiku` : "sin resultado en 10 min: se queda la cifra de Haiku",
        });
        res.abandonados++;
      } else if (action === "enviar") {
        const doc = await deps.repo.loadDoc(t.documentAnalysisId);
        if (doc) await sendJob(deps, t, doc.fileUrl);
        res.enviados++;
      } else if (action === "consultar") {
        const job = await deps.client.getJob(t.jobId!);
        res.consultados++;
        if (job && (await processJobUpdate(deps, t, job)) === "aplicado") res.aplicados++;
      }
    } catch (err: any) {
      (deps.log ?? console.error)("[contador] cron:", t.id, err?.message || err);
    }
  }
  return res;
}

export type ContadorStatus = {
  activo: boolean;
  estado: string | null;
  paginasHechas: number | null;
  paginasTotal: number | null;
  palabrasContador: number | null;
  palabrasHaiku: number | null;
  aplicado: boolean;
  aviso: any;
};

/** Estado para la pantalla de staff: solo lee la BD (lo actualizan el callback y el cron). */
export async function statusForDocument(deps: ContadorDeps, documentAnalysisId: string): Promise<ContadorStatus> {
  const t = await deps.repo.findTrabajoByDoc(documentAnalysisId);
  if (!t) return { activo: !!deps.client, estado: null, paginasHechas: null, paginasTotal: null, palabrasContador: null, palabrasHaiku: null, aplicado: false, aviso: null };
  return {
    activo: !!deps.client,
    estado: t.estado,
    paginasHechas: t.paginasHechas,
    paginasTotal: t.paginasTotal,
    palabrasContador: t.aplicadoAt ? (t.avisoJson?.contador ?? null) : null,
    palabrasHaiku: t.palabrasHaiku,
    aplicado: !!t.aplicadoAt,
    aviso: t.avisoJson ?? null,
  };
}

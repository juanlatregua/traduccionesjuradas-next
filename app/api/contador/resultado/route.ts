// app/api/contador/resultado/route.ts — Callback del contador de TraduCAT.
// Firma HMAC sobre "<timestamp>.<cuerpo crudo>" y marca de tiempo ±5 min;
// idempotente (la cifra se aplica una sola vez, lib/contador/flow.ts).
import { NextResponse } from "next/server";
import { sanitizeJob, verifyCallback } from "@/lib/contador/core";
import { processJobUpdate } from "@/lib/contador/flow";
import { contadorDeps, contadorSecret } from "@/lib/contador/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const secret = contadorSecret();
  if (!secret) return NextResponse.json({ ok: false, error: "Contador inactivo." }, { status: 503 });

  const rawBody = await req.text();
  if (rawBody.length > 200_000) return NextResponse.json({ ok: false, error: "Cuerpo demasiado grande." }, { status: 413 });
  const check = verifyCallback({
    secret,
    timestamp: req.headers.get("x-contador-timestamp"),
    signature: req.headers.get("x-contador-firma"),
    rawBody,
    now: Date.now(),
  });
  if (!check.ok) {
    console.error("[contador/resultado] firma rechazada:", check.reason);
    return NextResponse.json({ ok: false, error: "Firma no válida." }, { status: 401 });
  }

  let job;
  try {
    job = sanitizeJob(JSON.parse(rawBody));
  } catch {
    job = null;
  }
  if (!job) return NextResponse.json({ ok: false, error: "Cuerpo no válido." }, { status: 400 });

  try {
    const deps = contadorDeps();
    let trabajo = await deps.repo.findTrabajoByJobId(job.id);
    // El envío pudo caducar a los 5 s con el trabajo ya creado allí: se reconoce por la referencia.
    if (!trabajo && job.referencia) {
      const porRef = await deps.repo.findTrabajoByDoc(job.referencia);
      if (porRef && !porRef.jobId) {
        await deps.repo.updateTrabajo(porRef.id, { jobId: job.id });
        trabajo = { ...porRef, jobId: job.id };
      }
    }
    if (!trabajo || (job.referencia && job.referencia !== trabajo.documentAnalysisId)) {
      return NextResponse.json({ ok: false, error: "Trabajo desconocido." }, { status: 404 });
    }
    const result = await processJobUpdate(deps, trabajo, job);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("[contador/resultado]", err?.message || err);
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}

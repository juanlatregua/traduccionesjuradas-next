// POST /api/zona-traductor/contabilidad/asesor — Asesor contable IA (solo ADMIN).
// 1) calcula el dossier en código; 2) se lo pasa SOLO a Claude; 3) valida la
// salida. Nunca se llama solo al cargar la página: lo dispara un botón.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { loadDossier } from "@/lib/asesor-contable/load";
import { resolveLinks } from "@/lib/asesor-contable/validate";
import { analyzeDossier, askDossier, asesorModel, AsesorValidationError, type Turno } from "@/lib/ai/asesor-contable";

export const runtime = "nodejs";
export const maxDuration = 120;

const HOUR = 60 * 60 * 1000;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  if (getStaffRole(access.email) !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Solo el administrador puede usar el asesor contable." }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const action = body?.action === "preguntar" ? "preguntar" : body?.action === "analizar" ? "analizar" : null;
  const period = String(body?.period || "");
  if (!action) return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });

  // 10 análisis/hora; las preguntas tienen su propio tope para no esquivarlo.
  const limit = await checkRateLimit({
    key: `asesor-contable:${action}:${access.email}`,
    limit: action === "analizar" ? 10 : 30,
    windowMs: HOUR,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: `Límite alcanzado (${action === "analizar" ? "10 análisis" : "30 preguntas"} por hora). Reintenta en ${Math.ceil(limit.retryAfterSec / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const dossier = await loadDossier(period);
    if (!dossier) return NextResponse.json({ ok: false, error: "Periodo no válido." }, { status: 400 });
    const dossierHash = createHash("sha256").update(JSON.stringify(dossier)).digest("hex").slice(0, 16);
    const base = { ok: true, dossierHash, dossier, model: asesorModel(), generatedAt: new Date().toISOString() };

    if (action === "analizar") {
      const { value, usage } = await analyzeDossier(dossier);
      return NextResponse.json({
        ...base,
        usage,
        analisis: {
          ...value,
          alertas: value.alertas.map((a) => ({ ...a, links: resolveLinks(a.enlaces, dossier) })),
        },
      });
    }

    const pregunta = String(body?.pregunta || "").trim();
    if (!pregunta) return NextResponse.json({ ok: false, error: "Escribe una pregunta." }, { status: 400 });
    const historial: Turno[] = Array.isArray(body?.historial)
      ? body.historial
          .slice(-4)
          .map((t: any) => ({ pregunta: String(t?.pregunta || ""), respuesta: String(t?.respuesta || "") }))
          .filter((t: Turno) => t.pregunta && t.respuesta)
      : [];
    const { value, usage } = await askDossier(dossier, pregunta, historial);
    return NextResponse.json({
      ...base,
      usage,
      // Si el dossier cambió desde el análisis (datos nuevos), la pantalla avisa.
      dossierCambio: body?.dossierHash ? String(body.dossierHash) !== dossierHash : false,
      respuesta: { ...value, links: resolveLinks(value.enlaces, dossier) },
    });
  } catch (err: any) {
    if (err instanceof AsesorValidationError) {
      console.error("[asesor-contable] validación fallida", err.details);
      return NextResponse.json({ ok: false, error: `${err.message} Vuelve a intentarlo.`, details: err.details }, { status: 502 });
    }
    console.error("[asesor-contable] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo completar el análisis." }, { status: 500 });
  }
}

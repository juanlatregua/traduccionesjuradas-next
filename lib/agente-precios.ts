// lib/agente-precios.ts — Capa de BD de la política AUTÓNOMA del agente de precios
// (Juan, 9-oct-2026). La decisión vive en lib/learned-rates-math.ts (pura y
// testeada); aquí solo se cargan muestras, se aplica y se avisa.
//   · planAgentePrecios(): solo lectura — qué se aprobaría / degradaría hoy.
//   · runAgentePrecios(): aplica el plan, avisa por DOS canales de los degradados
//     por subida de coste y devuelve lo necesario para el resumen diario.
// Kill-switch: LEARNED_RATES_AUTO=off (y LEARNED_RATES_LIVE=off).

import { prisma } from "@/lib/prisma";
import { isAutoPriceable } from "@/lib/pricing-engine/languages";
import { rateKeyLabel } from "@/lib/learned-rates";
import {
  evaluateAutoApprove,
  evaluateDegrade,
  conversionOf,
  isAutoPolicyOn,
  type PolicySample,
  type AutoApproveVerdict,
  type DegradeVerdict,
} from "@/lib/learned-rates-math";

const eur = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toFixed(2)} €`);

type RateRow = Awaited<ReturnType<typeof loadRates>>[number];

async function loadRates() {
  const rates = await prisma.learnedRate.findMany({ include: { sampleRows: { orderBy: { createdAt: "asc" } } } });
  const refs = new Set<string>();
  for (const r of rates) for (const s of r.sampleRows) if (s.leadRef) refs.add(s.leadRef);
  const accepted = new Set(
    refs.size ? (await prisma.lavoriPriceRequest.findMany({ where: { ref: { in: Array.from(refs) }, status: "ACCEPTED" }, select: { ref: true } })).map((l) => l.ref) : []
  );
  return rates.map((r) => ({
    rate: r,
    samples: r.sampleRows.map<PolicySample>((s) => ({
      kind: s.kind,
      costCents: s.costCents,
      clientCents: s.clientCents,
      at: s.createdAt,
      accepted: s.kind === "client_paid" || !!s.orderRef || (!!s.leadRef && accepted.has(s.leadRef)),
    })),
  }));
}

export type PlanApproval = { rate: RateRow["rate"]; verdict: Extract<AutoApproveVerdict, { ok: true }> };
export type PlanDegrade = { rate: RateRow["rate"]; verdict: Extract<DegradeVerdict, { degrade: true }> };
export type PlanNear = { rate: RateRow["rate"]; reason: string };

/** Solo lectura: qué haría la política hoy. */
export async function planAgentePrecios(now = new Date()) {
  const rows = await loadRates();
  const approvals: PlanApproval[] = [];
  const degradations: PlanDegrade[] = [];
  const near: PlanNear[] = [];
  for (const { rate, samples } of rows) {
    if (rate.status === "CANDIDATE") {
      const v = evaluateAutoApprove(rate, samples, now, isAutoPriceable);
      if (v.ok) approvals.push({ rate, verdict: v });
      else if (v.near) near.push({ rate, reason: v.reason });
    } else if (rate.status === "APPROVED") {
      const v = evaluateDegrade(rate, samples, now);
      if (v.degrade) degradations.push({ rate, verdict: v });
    }
  }
  return { approvals, degradations, near, total: rows.length };
}

/** Presupuestos del tarifario por tarifa (auto_quote) enviados vs pagados. */
export async function conversionByRate() {
  const autos = await prisma.learnedRateSample.findMany({ where: { kind: "auto_quote", quoteId: { not: null } }, select: { rateId: true, quoteId: true } });
  if (autos.length === 0) return [];
  const quotes = await prisma.quote.findMany({
    where: { id: { in: Array.from(new Set(autos.map((a) => a.quoteId!))) } },
    select: { id: true, sentAt: true, paidAt: true, status: true },
  });
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const perRate = new Map<string, { sent: boolean; paid: boolean }[]>();
  for (const a of autos) {
    const q = byId.get(a.quoteId!);
    if (!q) continue;
    const list = perRate.get(a.rateId) || [];
    list.push({ sent: !!q.sentAt, paid: !!q.paidAt || ["PAID", "IN_PROGRESS", "DELIVERED"].includes(q.status) });
    perRate.set(a.rateId, list);
  }
  const rates = await prisma.learnedRate.findMany({ where: { id: { in: Array.from(perRate.keys()) } } });
  return rates.map((r) => ({ rate: r, ...conversionOf(perRate.get(r.id) || []) }));
}

async function alertTwoChannels(subject: string, lines: string[], sms: string, context: string) {
  const { sendMail } = await import("@/lib/azure-mail");
  const { sendStaffAlertSMS } = await import("@/lib/sms");
  const to = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";
  // Dos transportes independientes: el fallo de uno no tumba al otro.
  await Promise.all([
    sendMail({ to, subject, text: lines.join("\n"), html: lines.map((l) => `<p>${l}</p>`).join("") }).catch((e) => console.error("[agente-precios] mail fallo", e)),
    sendStaffAlertSMS(sms, context).catch((e) => console.error("[agente-precios] SMS fallo", e)),
  ]);
}

export type RunResult =
  | { skipped: string }
  | {
      approved: PlanApproval[];
      degraded: PlanDegrade[];
      near: PlanNear[];
      conversion: Awaited<ReturnType<typeof conversionByRate>>;
    };

/** Aplica la política. Rastro (muestra auto_approve / auto_degrade) ANTES de avisar. */
export async function runAgentePrecios(now = new Date()): Promise<RunResult> {
  if (!isAutoPolicyOn(process.env)) return { skipped: "LEARNED_RATES_AUTO/LEARNED_RATES_LIVE=off" };
  const plan = await planAgentePrecios(now);

  for (const a of plan.approvals) {
    const { rate, verdict } = a;
    // Condición en el UPDATE: si Juan la vetó o pausó entre la lectura y ahora, no se toca.
    // Cambio de estado y muestra de rastro, o las dos cosas o ninguna.
    const done = await prisma.$transaction(async (tx) => {
      const res = await tx.learnedRate.updateMany({ where: { id: rate.id, status: "CANDIDATE" }, data: { status: "APPROVED", clientCents: verdict.clientCents } });
      if (res.count === 0) return false;
      await tx.learnedRateSample.create({
        data: { rateId: rate.id, kind: "auto_approve", costCents: verdict.costCents, clientCents: verdict.priceCents, note: `auto-aprobada: ${verdict.samples} muestras, dispersión ${verdict.dispersionPct.toFixed(0)} %, margen ${verdict.marginPct.toFixed(0)} %` },
      });
      return true;
    });
    if (!done) continue;
  }

  for (const d of plan.degradations) {
    const { rate, verdict } = d;
    const done = await prisma.$transaction(async (tx) => {
      const res = await tx.learnedRate.updateMany({ where: { id: rate.id, status: "APPROVED" }, data: { status: "CANDIDATE" } });
      if (res.count === 0) return false;
      await tx.learnedRateSample.create({
        data: { rateId: rate.id, kind: "auto_degrade", costCents: rate.costCents, clientCents: null, note: `degradada: ${verdict.reason}` },
      });
      return true;
    });
    if (!done) continue;
    if (verdict.cause === "coste_sube" || verdict.cause === "coste_baja") {
      const label = rateKeyLabel(rate);
      const manual = verdict.handManaged ? " (aprobada/fijada por ti)" : "";
      const sube = verdict.cause === "coste_sube";
      if (sube) {
        await alertTwoChannels(
          `⚠ Tarifa ${label} degradada: el coste sube`,
          [
            `La tarifa ${label}${manual} vuelve a CANDIDATE porque ${verdict.reason}. Deja de presupuestar sola hasta que la revises.`,
            `Ahora: coste ${eur(rate.costCents)} · cliente ${eur(rate.clientCents)} · jurado ${rate.miembroNombre || "—"}.`,
            `Revisar: https://www.traduccionesjuradas.net/zona-traductor/tarifario`,
          ],
          `Tarifa ${label}${manual} degradada: coste ${eur(verdict.fromCents)} → ${eur(verdict.toCents)}. Ya no presupuesta sola. Revisar en /zona-traductor/tarifario`,
          `tarifa_degradada ${rate.id}`
        );
      } else {
        // El coste baja: no se pierde dinero, basta un canal (email).
        const { sendMail } = await import("@/lib/azure-mail");
        const lines = [
          `La tarifa ${label}${manual} vuelve a CANDIDATE porque ${verdict.reason}. Deja de presupuestar sola hasta que la revises.`,
          `Ahora: coste ${eur(rate.costCents)} · cliente ${eur(rate.clientCents)} · jurado ${rate.miembroNombre || "—"}.`,
          `Revisar: https://www.traduccionesjuradas.net/zona-traductor/tarifario`,
        ];
        await sendMail({
          to: process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net",
          subject: `Tarifa ${label} degradada: el coste baja`,
          text: lines.join("\n"),
          html: lines.map((l) => `<p>${l}</p>`).join(""),
        }).catch((e) => console.error("[agente-precios] mail fallo", e));
      }
    }
  }

  const conversion = await conversionByRate().catch(() => []);
  return { approved: plan.approvals, degraded: plan.degradations, near: plan.near, conversion };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function renderResumenHtml(r: Exclude<RunResult, { skipped: string }>) {
  const li = (s: string) => `<li>${esc(s)}</li>`;
  const sect = (title: string, items: string[]) => `<h3>${title} (${items.length})</h3>${items.length ? `<ul>${items.map(li).join("")}</ul>` : "<p>—</p>"}`;
  return [
    "<p>Resumen diario del agente de precios (política autónoma). Se apaga con LEARNED_RATES_AUTO=off.</p>",
    sect("Aprobadas hoy", r.approved.map(({ rate, verdict }) => `${rateKeyLabel(rate)} · coste ${eur(verdict.costCents)} · precio ${eur(verdict.priceCents)}${verdict.clientCents ? " (fijado por ti)" : ""} · ${verdict.samples} muestras · ${rate.miembroNombre || "sin jurado"}`)),
    sect("Degradadas", r.degraded.map(({ rate, verdict }) => `${rateKeyLabel(rate)} · ${verdict.reason}${verdict.handManaged ? " · (la habías aprobado/fijado tú)" : ""}`)),
    sect("Candidatas a un paso de aprobarse", r.near.map(({ rate, reason }) => `${rateKeyLabel(rate)} · coste ${eur(rate.costCents)} · falta: ${reason}`)),
    sect("Conversión por tarifa (presupuestos del tarifario)", r.conversion.map((c) => `${rateKeyLabel(c.rate)} · ${c.sent} enviados · ${c.paid} pagados${c.pct == null ? "" : ` (${c.pct.toFixed(0)} %)`}`)),
  ].join("");
}

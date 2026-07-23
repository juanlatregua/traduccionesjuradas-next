import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin · Métricas v2",
  robots: { index: false, follow: false },
};

// Las 4 métricas estrella del brief v2 en una sola pantalla. La promesa de v2
// es medible: aquí está el cuadro. Donde la señal vive fuera (Vercel Analytics,
// Google) se dice con honestidad en lugar de inventar un número.

// Línea base CONGELADA: abril 2026, el mes anterior al arranque de v2 Fase 1
// (la puerta, ~19 may 2026). Es una ventana fija — no se mueve con el tiempo —,
// así que la conversión "ahora" se compara siempre contra el mismo punto pre-v2.
const BASELINE_FROM = new Date("2026-04-01T00:00:00.000Z");
const BASELINE_TO = new Date("2026-05-01T00:00:00.000Z");
const BASELINE_LABEL = "Línea base · abril 2026 (pre-v2)";

async function payConversion(from: Date, to: Date) {
  const where = { createdAt: { gte: from, lt: to } };
  const [analizado, pagado] = await Promise.all([
    prisma.documentAnalysis.count({ where }),
    prisma.documentAnalysis.count({
      where: { ...where, order: { is: { paymentStatus: "PAID" } } },
    }),
  ]);
  const ratePct = analizado > 0 ? (pagado / analizado) * 100 : null;
  return { analizado, pagado, ratePct };
}

function fmtPct(p: number | null) {
  return p === null ? "—" : `${p.toFixed(1)} %`;
}

function Card({
  n,
  title,
  measure,
  children,
}: {
  n: number;
  title: string;
  measure: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-bold text-slate-400">#{n}</span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
        {measure}
      </p>
    </section>
  );
}

function Big({ value, sub }: { value: string; sub: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{sub}</p>
    </div>
  );
}

export default async function AdminMetricasPage() {
  await requireAdminPageAccess("/admin/metricas");

  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [baseline, last30, askNow, askAll, reviewNow, reviewAll] = await Promise.all([
    payConversion(BASELINE_FROM, BASELINE_TO),
    payConversion(since30, now),
    prisma.chatSession.count({
      where: { detectedIntent: "order_status", createdAt: { gte: since30 } },
    }),
    prisma.chatSession.count({ where: { detectedIntent: "order_status" } }),
    prisma.orderEvent.count({
      where: { type: "notification.review_request.sent", createdAt: { gte: since30 } },
    }),
    prisma.orderEvent.count({ where: { type: "notification.review_request.sent" } }),
  ]);

  const delta =
    baseline.ratePct !== null && last30.ratePct !== null
      ? last30.ratePct - baseline.ratePct
      : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <AdminNav />

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Métricas v2</h1>
        <p className="mt-1 text-sm text-slate-500">
          Las 4 métricas estrella del brief, en una pantalla. {BASELINE_LABEL} como
          referencia congelada para demostrar la mejora.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* #2 — la estrella: % de visitantes que llegan a pago */}
        <Card
          n={2}
          title="% que llega a pago (estrella)"
          measure="analizado → pagado, vía DocumentAnalysis enlazado a Order PAID. Comparación contra la línea base congelada (abril 2026, pre-v2)."
        >
          <div className="flex items-end justify-between gap-4">
            <Big
              value={fmtPct(last30.ratePct)}
              sub={`últimos 30 días · ${last30.pagado}/${last30.analizado}`}
            />
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-slate-500">
                {fmtPct(baseline.ratePct)}
              </p>
              <p className="text-xs text-slate-400">
                línea base · {baseline.pagado}/{baseline.analizado}
              </p>
            </div>
          </div>
          {delta !== null && (
            <p
              className={`mt-3 text-sm font-semibold ${
                delta >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts vs línea base
            </p>
          )}
        </Card>

        {/* #3 — ¿dónde está mi pedido? (recién instrumentada en el chat) */}
        <Card
          n={3}
          title="«¿Dónde está mi pedido?»"
          measure="Mensajes al chat con intención order_status (ChatSession.detectedIntent). Recién instrumentado: el histórico empieza a contar desde el despliegue. El acompañamiento de Fase 2 (SMS por hito + página de estado) busca bajarlo."
        >
          <div className="flex items-end justify-between gap-4">
            <Big value={String(askNow)} sub="últimos 30 días" />
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-slate-500">{askAll}</p>
              <p className="text-xs text-slate-400">total acumulado</p>
            </div>
          </div>
        </Card>

        {/* #4 — reseñas */}
        <Card
          n={4}
          title="Reseñas post-entrega"
          measure="Solicitudes de reseña enviadas (OrderEvent notification.review_request.sent). Las reseñas OBTENIDAS viven en Google (externo) — consultar el perfil de empresa."
        >
          <div className="flex items-end justify-between gap-4">
            <Big value={String(reviewNow)} sub="solicitadas · últimos 30 días" />
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-slate-500">{reviewAll}</p>
              <p className="text-xs text-slate-400">total solicitadas</p>
            </div>
          </div>
          <a
            href="https://www.google.com/maps?cid=1858671208989418611"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-bleu hover:underline"
          >
            Ver reseñas obtenidas en Google →
          </a>
        </Card>

        {/* #1 — rebote (externo: Vercel Analytics) */}
        <Card
          n={1}
          title="% de rebote en landing"
          measure="El rebote y las visitas a la landing se miden en Vercel Web Analytics (script en app/layout.tsx). No se reconstruye in-app sin la API de Vercel — el panel oficial es la fuente."
        >
          <Big value="Vercel Analytics" sub="rebote + visitas de la landing" />
          <a
            href="https://vercel.com/juan-silvas-projects-6692e201/traduccionesjuradas-net/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-bleu hover:underline"
          >
            Abrir Vercel Analytics →
          </a>
        </Card>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Conversión paso a paso (las 5 etapas del funnel) en{" "}
        <a href="/admin/funnel" className="font-semibold text-bleu hover:underline">
          Funnel
        </a>
        .
      </p>
    </main>
  );
}

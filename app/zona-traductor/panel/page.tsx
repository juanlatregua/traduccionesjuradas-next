import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { getStaffRole } from "@/lib/staff-access";
import { loadPanelAgenda, loadPanelData } from "@/lib/panel-data";
import { buildPeriod, GRANULARITIES, parseGranularity, shiftAnchor, todayMadrid } from "@/lib/panel-period";
import PanelBoard from "@/components/panel/PanelBoard";
import PanelAgenda from "@/components/panel/PanelAgenda";

export const metadata: Metadata = {
  title: "Zona traductor — Panel",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60a5fa]";
const CTRL = `rounded-lg border border-[#232a35] bg-[#14181f] px-3 py-1.5 text-xs font-semibold text-[#e8ecf2] hover:border-[#93a0b4] ${FOCUS}`;

export default async function PanelPage({ searchParams }: { searchParams: { p?: string; d?: string } }) {
  const email = await authZonaTraductorOrRedirect();
  if (getStaffRole(email) !== "ADMIN") redirect("/zona-traductor");

  const p = parseGranularity(searchParams.p);
  const period = buildPeriod(p, searchParams.d);
  const href = (g: string, d: string) => `/zona-traductor/panel?p=${g}&d=${d}`;

  const [{ current, previous }, agenda] = await Promise.all([loadPanelData(period), loadPanelAgenda()]);

  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-6 text-[#e8ecf2] sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Panel</h1>
          <nav aria-label="Periodo" className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Granularidad" className="flex gap-1">
              {GRANULARITIES.map((g) => (
                <Link
                  key={g.value}
                  href={href(g.value, period.anchor)}
                  aria-current={g.value === p ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${FOCUS} ${g.value === p ? "bg-[#3ecf8e] text-[#0b0d10]" : "border border-[#232a35] bg-[#14181f] text-[#e8ecf2] hover:border-[#93a0b4]"}`}
                >
                  {g.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Link href={href(p, shiftAnchor(p, period.anchor, -1))} aria-label="Periodo anterior" className={CTRL}>
                ←
              </Link>
              <span className="min-w-[9rem] text-center text-sm font-medium capitalize tabular-nums" aria-live="polite">
                {period.label}
              </span>
              <Link href={href(p, shiftAnchor(p, period.anchor, 1))} aria-label="Periodo siguiente" className={CTRL}>
                →
              </Link>
            </div>
            <Link href={href(p, todayMadrid())} className={CTRL}>
              Hoy
            </Link>
            <form method="get" action="/zona-traductor/panel" className="flex items-center gap-1">
              <input type="hidden" name="p" value={p} />
              <label htmlFor="panel-d" className="sr-only">
                Ir a la fecha
              </label>
              <input id="panel-d" type="date" name="d" defaultValue={period.anchor} className={`rounded-lg border border-[#232a35] bg-[#14181f] px-2 py-1.5 text-xs text-[#e8ecf2] [color-scheme:dark] ${FOCUS}`} />
              <button type="submit" className={CTRL}>
                Ir
              </button>
            </form>
          </nav>
        </header>

        <PanelAgenda agenda={agenda} />
        <PanelBoard period={period} current={current} previous={previous} />
      </div>
    </main>
  );
}

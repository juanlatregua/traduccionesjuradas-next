import Link from "next/link";
import type { AgendaEntry, PanelAgenda as Agenda } from "@/lib/panel-data";

const GROUPS: { key: keyof Agenda; title: string }[] = [
  { key: "entregas", title: "Entregas hoy y mañana" },
  { key: "sinTraductor", title: "Pagados sin traductor" },
  { key: "dirigidosSinAceptar", title: "Encargos dirigidos sin aceptar" },
  { key: "caducan", title: "Presupuestos que caducan (≤3 días)" },
  { key: "preciosSinPresupuesto", title: "Precios de Lavori sin presupuesto" },
];

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60a5fa]";

function Entry({ e }: { e: AgendaEntry }) {
  return (
    <li>
      <Link href={e.href} className={`flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-[#1b212b] ${FOCUS}`}>
        <span className="truncate">{e.text}</span>
        {e.note && <span className="shrink-0 tabular-nums text-[#93a0b4]">{e.note}</span>}
      </Link>
    </li>
  );
}

export default function PanelAgenda({ agenda }: { agenda: Agenda }) {
  return (
    <section aria-label="Agenda de hoy" className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-[#93a0b4]">Agenda de hoy</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GROUPS.map(({ key, title }) => {
          const items = agenda[key];
          return (
            <div key={key} className="rounded-xl border border-[#232a35] bg-[#14181f] p-3">
              <h3 className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[#93a0b4]">
                {title}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${items.length ? "bg-[#fbbf24]/15 text-[#fbbf24]" : "bg-[#3ecf8e]/15 text-[#3ecf8e]"}`}>{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="text-xs text-[#93a0b4]">Nada pendiente.</p>
              ) : (
                <ul className="max-h-40 space-y-0.5 overflow-auto">
                  {items.map((e) => (
                    <Entry key={e.ref} e={e} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

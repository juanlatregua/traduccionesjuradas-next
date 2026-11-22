import Link from "next/link";
import type { AgendaEntry, PanelAgenda as Agenda } from "@/lib/panel-data";

const GROUPS: { key: keyof Agenda; title: string }[] = [
  { key: "entregas", title: "Entregas hoy y mañana" },
  { key: "sinTraductor", title: "Pagados sin traductor" },
  { key: "dirigidosSinAceptar", title: "Encargos dirigidos sin aceptar" },
  { key: "caducan", title: "Presupuestos que caducan (≤3 días)" },
  { key: "preciosSinPresupuesto", title: "Precios de Lavori sin presupuesto" },
];

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2E4A]";

function Entry({ e }: { e: AgendaEntry }) {
  return (
    <li>
      <Link href={e.href} className={`flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-[#F6F7F9] ${FOCUS}`}>
        <span className="truncate">{e.text}</span>
        {e.note && <span className="shrink-0 tabular-nums text-[#52606D]">{e.note}</span>}
      </Link>
    </li>
  );
}

export default function PanelAgenda({ agenda }: { agenda: Agenda }) {
  return (
    <section aria-label="Agenda de hoy" className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-[#52606D]">Agenda de hoy</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GROUPS.map(({ key, title }) => {
          const items = agenda[key];
          return (
            <div key={key} className="rounded-xl border border-[#D5DAE1] bg-[#ffffff] p-3">
              <h3 className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-[#52606D]">
                {title}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${items.length ? "bg-[#7A5A10]/15 text-[#7A5A10]" : "bg-[#1F6B45]/15 text-[#1F6B45]"}`}>{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="text-xs text-[#52606D]">Nada pendiente.</p>
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

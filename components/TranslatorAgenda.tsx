type AgendaItem = {
  reference: string;
  title: string;
  dueDate: Date | null;
  deliveryState: string;
  assignedTo: string | null;
};

type Props = {
  items: AgendaItem[];
};

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function labelState(state: string) {
  if (state === "TRADUCIDO") return "Traducido";
  if (state === "EN_PROCESO") return "En proceso";
  return "Presupuesto";
}

export default function TranslatorAgenda({ items }: Props) {
  const withDueDate = items
    .filter((x) => !!x.dueDate && x.deliveryState !== "TRADUCIDO")
    .sort((a, b) => Number(a.dueDate) - Number(b.dueDate));

  const grouped = new Map<string, AgendaItem[]>();
  for (const it of withDueDate) {
    const key = ymd(it.dueDate as Date);
    const prev = grouped.get(key) || [];
    prev.push(it);
    grouped.set(key, prev);
  }

  if (grouped.size === 0) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <h2 className="text-lg font-semibold text-white">Agenda de plazos</h2>
        <p className="mt-3 text-sm text-slate-400">No hay entregas con fecha prevista.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <h2 className="text-lg font-semibold text-white">Agenda de plazos</h2>
      <p className="mt-1 text-xs text-slate-400">Vista compartida de tareas con fecha estimada.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from(grouped.entries()).map(([day, rows]) => (
          <div key={day} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              {new Date(day).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li key={row.reference} className="rounded-xl border border-slate-700 bg-slate-900/70 p-2.5">
                  <p className="font-mono text-xs font-bold text-cyan-300">{row.reference}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-200">{row.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {labelState(row.deliveryState)}{row.assignedTo ? ` · ${row.assignedTo}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}


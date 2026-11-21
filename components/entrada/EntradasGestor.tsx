import { fmtNeededBy } from "@/lib/needed-by";

type Entrada = {
  id: string;
  canal: string;
  estado: string;
  casoId: string | null;
  regla: string | null;
  posibles: string[];
  relacionados: string[];
  sourceLang: string | null;
  targetLang: string | null;
  targetLangs: string[];
  pais: string | null;
  respuestasJson: unknown;
  source: string | null;
  lang: string | null;
  email: string | null;
  phone9: string | null;
  nombre: string | null;
  urgency: string | null;
  neededBy: Date | null;
  organismo: string | null;
  notas: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
};

const ESTADO: Record<string, string> = { abierta: "subiendo", leida: "leída, sin confirmar", confirmada: "confirmada por el cliente", sin_jurado: "sin jurado" };
const plazo = (e: Entrada) => (e.urgency === "DATE" && e.neededBy ? `para el ${fmtNeededBy(e.neededBy)}` : e.urgency === "ASAP" ? "lo antes posible" : e.urgency === "FLEXIBLE" ? "sin prisa" : "sin plazo");
const fecha = (d: Date) => d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function EntradaResumen({ entradas, refs }: { entradas: Entrada[]; refs: Record<string, string> }) {
  if (entradas.length === 0) return null;
  return (
    <section className="mb-6 space-y-2">
      {entradas.map((e) => (
        <div key={e.id} className="rounded-lg border border-cyan-900 bg-white px-4 py-3 text-sm text-[#1F2933]">
          <p className="font-semibold text-[#1A2E4A]">
            Entrada {e.canal} · {ESTADO[e.estado] ?? e.estado}
            {e.confirmedAt ? ` · ${fecha(e.confirmedAt)}` : ""}
          </p>
          <p className="text-[#52606D]">{[e.nombre, e.email, e.phone9].filter(Boolean).join(" · ")} · {plazo(e)}{e.organismo ? ` · ${e.organismo}` : ""}</p>
          {(e.source || (e.lang && e.lang !== "es")) && <p className="text-[#52606D]">{[e.source && `origen ${e.source}`, e.lang && e.lang !== "es" && `idioma del cliente: ${e.lang}`].filter(Boolean).join(" · ")}</p>}
          <p className="text-[#52606D]">Idiomas: {e.sourceLang ?? "?"} → {(e.targetLangs.length ? e.targetLangs : e.targetLang ? [e.targetLang] : ["?"]).join(", ")}{e.pais ? ` · país ${e.pais}` : ""}</p>
          {Array.isArray(e.respuestasJson) && (e.respuestasJson as { pregunta: string; respuesta: string }[]).map((r, i) => (
            <p key={i} className="text-[#1F2933]">{r.pregunta} → <strong>{r.respuesta}</strong></p>
          ))}
          {e.notas && <p className="mt-1 text-[#1F2933]">«{e.notas}»</p>}
          {e.relacionados.length > 0 && (
            <p className="mt-1 text-[#1A2E4A]">Relacionado con {e.relacionados.map((id) => refs[id] ?? id).join(", ")}: mismo archivo en un caso ya encargado o cerrado. No se ha unido.</p>
          )}
          {e.regla === "dudoso" && e.posibles.length > 0 && (
            <p className="mt-1 text-[#7A5A10]">
              ¿Mismo cliente que {e.posibles.map((id) => refs[id] ?? id).join(", ")}? No se ha unido: revísalo.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

export function EntradasPendientes({ entradas, refs }: { entradas: Entrada[]; refs: Record<string, string> }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-[#1A2E4A]">Entradas de clientes</h2>
      {entradas.length === 0 && <p className="text-sm text-[#52606D]">No hay entradas pendientes.</p>}
      <ul className="space-y-2">
        {entradas.map((e) => (
          <li key={e.id}>
            <a href={e.casoId ? `/zona-traductor/lectura?caso=${encodeURIComponent(e.casoId)}` : "#"} className="block rounded-lg border border-[#D5DAE1] bg-white px-4 py-3 text-sm text-[#1F2933] hover:border-cyan-700">
              <span className="font-semibold text-[#1A2E4A]">{e.casoId ? refs[e.casoId] ?? e.casoId : "sin caso"}</span> · {ESTADO[e.estado] ?? e.estado} · {[e.nombre, e.email, e.phone9].filter(Boolean).join(" · ")} · {plazo(e)}
              {e.regla === "dudoso" && <span className="ml-2 text-[#7A5A10]">¿mismo cliente?</span>}
              {e.relacionados.length > 0 && <span className="ml-2 text-[#1A2E4A]">relacionado con {e.relacionados.map((id) => refs[id] ?? id).join(", ")}</span>}
              <span className="ml-2 text-[#52606D]">{fecha(e.confirmedAt ?? e.createdAt)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

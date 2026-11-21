import Link from "next/link";
import { MONTONES, type Mesa, type Tarjeta as T } from "@/lib/mesa/montones";
import { MesaAccion, MesaActualizar, MesaEnlace } from "./MesaBoton";
import { Marca, Par, RelojMarca, fmtFecha } from "./piezas";

function Fila({ t }: { t: T }) {
  return (
    <li className="grid gap-x-4 gap-y-2 rounded-[14px] border border-[#D5DAE1] bg-[#fff] p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1.3fr)_auto] md:items-start md:rounded-none md:border-0 md:border-b md:border-[#E8EBEF] md:bg-transparent md:px-3 md:py-3 md:last:border-b-0">
      <div className="min-w-0">
        {t.ficha ? (
          <Link href={t.ficha} className="text-[17px] font-bold text-[#1A2E4A] underline-offset-2 hover:underline">
            {t.cliente}
          </Link>
        ) : (
          <span className="text-[17px] font-bold text-[#1A2E4A]">{t.cliente}</span>
        )}
        <span className="block text-[14px] text-[#52606D]">
          {[t.ref, t.canal, `entró ${fmtFecha(t.entro)}`].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="min-w-0">
        <span className="block font-semibold text-[#1F2933]">{t.titulo}</span>
        {t.detalle && <span className="block text-[14px] text-[#52606D]">{t.detalle}</span>}
        {(t.pares.length > 0 || t.dudoso) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {t.pares.map((p) => (
              <Par key={p} par={p} />
            ))}
            {t.dudoso && <Marca tono="warn">dudoso: revisar a mano</Marca>}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        {t.reloj ? <RelojMarca reloj={t.reloj} /> : <span className="text-[14px] text-[#52606D]">Sin reloj</span>}
        {t.plazoCliente ? <span className={`text-[14px] ${t.urgente ? "font-bold text-[#8B1E0F]" : "text-[#52606D]"}`}>{t.plazoCliente}</span> : t.monton === "yo" && t.casoId ? <span className="text-[14px] text-[#52606D]">Sin fecha del cliente: preguntarla</span> : null}
      </div>
      <div className="flex flex-wrap gap-2 md:flex-nowrap md:justify-end">
        {t.accion && <MesaAccion {...t.accion} className="flex-1 md:flex-none" variante={t.monton === "yo" ? "pri" : "sec"} />}
        {t.ficha && <MesaEnlace label="Ficha" href={t.ficha} variante="sec" que="la ficha del caso" className="flex-1 md:flex-none" />}
      </div>
    </li>
  );
}

function Lista({ filas }: { filas: T[] }) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0 md:gap-0 md:rounded-[14px] md:border md:border-[#D5DAE1] md:bg-[#fff]">
      {filas.map((t) => (
        <Fila key={t.key} t={t} />
      ))}
    </ul>
  );
}

export default function HoyVista({ mesa, ahora }: { mesa: Mesa & { avisos: string[] }; ahora: Date }) {
  const hoy = ahora.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
  const resumen = [hoy.charAt(0).toUpperCase() + hoy.slice(1), `${mesa.yo.length} te ${mesa.yo.length === 1 ? "toca" : "tocan"}`];
  if (mesa.vencidos) resumen.push(`${mesa.vencidos} con el reloj pasado`);
  if (mesa.entreganHoy) resumen.push(`${mesa.entreganHoy} se ${mesa.entreganHoy === 1 ? "entrega" : "entregan"} hoy`);
  return (
    <div className="min-h-screen bg-[#F4F5F7] font-sans text-[16px] leading-[1.45] text-[#1F2933]">
      <main className="mx-auto max-w-[1280px] px-4 py-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] font-bold text-[#1A2E4A]">Hoy</h1>
            <p className="text-[#52606D]">{resumen.join(" · ")}</p>
          </div>
          <Link href="/zona-traductor/casos" className="inline-flex min-h-[44px] items-center px-2 font-semibold text-[#17477E] underline">
            Todos los casos
          </Link>
          <MesaActualizar />
        </div>
        {mesa.avisos.map((a) => (
          <p key={a} role="alert" className="mb-3 rounded-[10px] border-2 border-[#8B1E0F] bg-[#FBE4DF] px-3 py-2 text-[#5E130A]">
            {a}
          </p>
        ))}
        {MONTONES.map((m) => {
          const filas = mesa[m.key];
          const abiertas = filas.filter((t) => !t.plegada);
          const plegadas = filas.filter((t) => t.plegada);
          return (
            <section key={m.key} aria-labelledby={`monton-${m.key}`} className="mb-6">
              <div className="mb-2 mt-4 flex flex-wrap items-baseline gap-2">
                <h2 id={`monton-${m.key}`} className="text-[18px] font-bold text-[#1A2E4A]">
                  {m.titulo} <span className="font-normal text-[#52606D]">({abiertas.length})</span>
                </h2>
                <span className="text-[14px] text-[#52606D]">{m.sub}</span>
              </div>
              {abiertas.length ? (
                <Lista filas={abiertas} />
              ) : (
                <p className="rounded-[14px] border border-dashed border-[#9AA3AF] bg-[#fff] p-4 text-center text-[#52606D]">Nada aquí.</p>
              )}
              {plegadas.length > 0 && (
                <details className="mt-2">
                  <summary className="flex min-h-[44px] cursor-pointer items-center font-semibold text-[#1A2E4A]">
                    {plegadas.length} {plegadas.length === 1 ? "presupuesto cerrado" : "presupuestos cerrados"} por silencio que aún se pueden pagar (nada que hacer)
                  </summary>
                  <Lista filas={plegadas} />
                </details>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}

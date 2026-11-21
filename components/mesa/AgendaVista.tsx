import Link from "next/link";
import type { AgendaItem } from "@/lib/vigia";
import { hrefPedido } from "@/lib/staff-links";
import { MesaMarca } from "./MesaBoton";
import { Marca, Par, eur } from "./piezas";

export type AccionAgenda = {
  que: string;
  href: string;
  estado?: string;
  extras?: string[];
  botones?: { label: string; href: string }[];
  tratado: string | null;
  posponer: string | null;
};
export type AgendaHoy = {
  traducir: AgendaItem[];
  seguir: AgendaItem[];
  entregar: AgendaItem[];
  sinFecha: AgendaItem[];
  palabrasSemana: number;
  horasSemana: number;
  diasNecesarios: number;
  acciones: AccionAgenda[];
  ocultos: number;
};

const dia = (mmdd: string | null) => (mmdd ? mmdd.split("-").reverse().join("/") : "");

function Vence({ i }: { i: AgendaItem }) {
  if (i.venceDias == null) return <Marca tono="bad">Sin fecha</Marca>;
  if (i.venceDias < 0) return <Marca tono="bad">Vencido {-i.venceDias} d ({dia(i.vence)})</Marca>;
  if (i.venceDias === 0) return <Marca tono="warn">Hoy</Marca>;
  return <Marca tono={i.venceDias === 1 ? "warn" : "info"}>{i.venceDias === 1 ? "Mañana" : `En ${i.venceDias} d`} ({dia(i.vence)})</Marca>;
}

function Filas({ items, vacio, conQuien = true }: { items: AgendaItem[]; vacio: string; conQuien?: boolean }) {
  if (!items.length) return <p className="text-[15px] text-[#52606D]">{vacio}</p>;
  return (
    <ul className="m-0 grid list-none gap-0 p-0">
      {items.map((i) => (
        <li key={i.ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#E8EBEF] py-2 last:border-b-0">
          <Link href={hrefPedido(i.ref)} className="font-bold text-[#1A2E4A] underline-offset-2 hover:underline">
            {i.ref}
          </Link>
          <span className="min-w-0 [overflow-wrap:anywhere]">{i.cliente}</span>
          <Par par={i.par} />
          <span className="tabular-nums">{eur(i.importe)}</span>
          <span className="text-[14px] text-[#52606D]">
            {i.docs} doc{i.palabras ? ` · ${i.palabras} pal. ≈ ${i.horas} h` : ""}
          </span>
          <Vence i={i} />
          {conQuien && !/juan/i.test(i.quien) && <span className="text-[14px] text-[#52606D]">{i.quien}</span>}
        </li>
      ))}
    </ul>
  );
}

function Bloque({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[#D5DAE1] bg-[#fff] p-3">
      <h3 className="text-[16px] font-bold text-[#1A2E4A]">{titulo}</h3>
      {sub && <p className="mb-1 text-[14px] text-[#52606D]">{sub}</p>}
      {children}
    </div>
  );
}

export default function AgendaVista({ agenda }: { agenda: AgendaHoy }) {
  const a = agenda;
  return (
    <section aria-labelledby="agenda" className="mb-6">
      <div className="mb-2 mt-4 flex flex-wrap items-baseline gap-2">
        <h2 id="agenda" className="text-[18px] font-bold text-[#1A2E4A]">
          Agenda
        </h2>
        <span className="text-[14px] text-[#52606D]">
          Lo tuyo: {a.palabrasSemana} palabras ≈ {a.horasSemana} h ≈ {a.diasNecesarios} días. Sin repetir lo que ya está en «Me toca a mí».
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Bloque titulo={`Traducir (tú) · ${a.traducir.length}`} sub="Por vencimiento.">
          <Filas items={a.traducir} vacio="Nada pendiente tuyo." conQuien={false} />
        </Bloque>
        <Bloque titulo={`Seguir (jurados) · ${a.seguir.length}`} sub="Por vencimiento.">
          <Filas items={a.seguir} vacio="Sin entregas de jurados pendientes." />
        </Bloque>
        {a.entregar.length > 0 && (
          <Bloque titulo={`Entregar al cliente · ${a.entregar.length}`} sub="El jurado ya entregó: falta verificar y enviar (o el papel).">
            <Filas items={a.entregar} vacio="" />
          </Bloque>
        )}
        {a.sinFecha.length > 0 && (
          <Bloque titulo={`Sin fecha de entrega · ${a.sinFecha.length}`} sub="Ponla en el pedido.">
            <Filas items={a.sinFecha} vacio="" />
          </Bloque>
        )}
      </div>
      {a.acciones.length > 0 && (
        <details open className="mt-3 rounded-[14px] border border-[#D5DAE1] bg-[#fff] p-3">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-[16px] font-bold text-[#1A2E4A]">
            Recuperar · {a.acciones.length}
            <span className="ml-2 font-normal text-[#52606D]">una fila por persona o pedido; «Ya lo traté» la oculta 4 días, «Posponer 7 d» una semana{a.ocultos ? ` · ${a.ocultos} ocultas` : ""}</span>
          </summary>
          <ol className="m-0 grid list-none gap-0 p-0">
            {a.acciones.map((x, i) => (
              <li key={i} className="grid gap-2 border-b border-[#E8EBEF] py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <Link href={x.href} className="font-semibold text-[#1F2933] underline-offset-2 hover:underline">
                    {x.que}
                  </Link>
                  {x.extras?.length ? <span className="block text-[14px] text-[#52606D]">también: {x.extras.join(" · ")}</span> : null}
                  {x.estado && <span className="block text-[14px] text-[#52606D]">{x.estado}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {x.tratado && <MesaMarca label="Ya lo traté" hecho="Tratado" url={x.tratado} />}
                  {x.posponer && <MesaMarca label="Posponer 7 d" hecho="Pospuesto" url={x.posponer} />}
                  {x.botones?.map((b) => (
                    <a key={b.href} href={b.href} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center px-2 text-[14px] font-semibold text-[#17477E] underline">
                      {b.label}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

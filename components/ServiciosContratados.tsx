import type { Servicio } from "@/lib/asesor-contable/servicios";

const money = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ServiciosContratados({ servicios }: { servicios: Servicio[] }) {
  const total = servicios.reduce((s, x) => s + x.anual_estimado_eur, 0);
  const aCero = servicios.reduce((s, x) => s + x.meses_a_cero, 0);

  return (
    <section className="mt-6 rounded-xl border border-[#D5DAE1] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1A2E4A]">Servicios contratados</h2>
          <p className="text-xs text-[#52606D]">Últimos 12 meses, con IVA. Sin traductores, nómina ni Seguridad Social.</p>
        </div>
        <p className="font-mono text-sm text-[#1F2933]">≈ {money(total)} €/año</p>
      </div>

      {aCero > 0 && <p className="mt-3 text-xs text-[#7A5A10]">Hay {aCero} apuntes a 0 €: esos meses están sin completar y el coste real es mayor.</p>}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#D5DAE1] text-left text-xs text-[#52606D]">
              <th className="py-2 pr-3 font-medium">Proveedor</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 pr-3 font-medium">Último cargo</th>
              <th className="py-2 pr-3 text-right font-medium">12 meses</th>
              <th className="py-2 text-right font-medium">Al año</th>
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => (
              <tr key={s.proveedor} className="border-b border-[#D5DAE1] align-top text-[#1F2933]">
                <td className="py-2 pr-3">
                  {s.proveedor}
                  {s.nota && <p className="mt-0.5 max-w-md text-xs text-[#7A5A10]">{s.nota}</p>}
                </td>
                <td className="py-2 pr-3 text-[#52606D]">{s.tipo}</td>
                <td className="py-2 pr-3 text-[#52606D]">
                  {s.ultimo_cargo} · {money(s.ultimo_importe_eur)} €
                </td>
                <td className="py-2 pr-3 text-right font-mono">{money(s.total_12_meses_eur)}</td>
                <td className="py-2 text-right font-mono">{money(s.anual_estimado_eur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#52606D]">Pregúntale al asesor de arriba: «¿dónde puedo ahorrar en servicios contratados?».</p>
    </section>
  );
}

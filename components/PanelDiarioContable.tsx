// Panel diario de Contabilidad: lo básico de hoy y lo único que necesita a Juan.
// El detalle sigue debajo, para cuando haya que investigar.
import type { ResumenPanel } from "@/lib/panel-contable";

export type FacturaParada = { expenseId: string; reference: string | null; supplier: string | null; motivo: string };

const eur = (cents: number) => `${(cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Cifra({ label, valor, nota, tono = "text-white" }: { label: string; valor: string; nota: string; tono?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tono}`}>{valor}</p>
      <p className="mt-1 text-[11px] text-slate-500">{nota}</p>
    </div>
  );
}

export default function PanelDiarioContable({ resumen, paradas, porLeer }: { resumen: ResumenPanel; paradas: FacturaParada[]; porLeer: number }) {
  const r = resumen;
  return (
    <section aria-label="Panel diario" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra label="Facturado este mes" valor={eur(r.ingresosMesCents)} nota="Sin IVA, las dos actividades" />
        <Cifra
          label="Resultado del mes"
          valor={eur(r.resultadoMesCents)}
          nota={`Suma ${eur(r.cobradoSinFacturaMesCents)} cobrados sin factura; resta ${eur(r.gastosMesCents)} de gastos y ${eur(r.costeSinFacturaMesCents)} de traductores sin factura`}
          tono={r.resultadoMesCents >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <Cifra
          label="A guardar este trimestre"
          valor={eur(r.reservasCents)}
          nota={`IVA ${eur(r.ivaTrimestreCents)} · retenciones ${eur(r.retencionesTrimestreCents)}. Sin Sociedades.`}
        />
      </div>

      {paradas.length > 0 ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold text-amber-200">Necesitan tu decisión ({paradas.length})</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-200">
            {paradas.map((p) => (
              <li key={p.expenseId}>
                {p.reference ? (
                  <a href={`/zona-traductor/pedido/${p.reference}`} className="font-semibold text-cyan-300 hover:underline">
                    {p.reference}
                  </a>
                ) : (
                  "Sin pedido"
                )}{" "}
                · {p.supplier || "Proveedor"}: {p.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Nada espera tu decisión.</p>
      )}

      {porLeer > 0 && <p className="text-[11px] text-slate-500">{porLeer} factura(s) de traductor por leer: el agente pasa cada mañana.</p>}

      {r.gastosSinCompletar > 0 && (
        <p className="text-[11px] text-slate-500">
          {r.gastosSinCompletar} gasto(s) del trimestre sin completar: no cuentan en estas cifras hasta confirmarse en el detalle.
        </p>
      )}
    </section>
  );
}

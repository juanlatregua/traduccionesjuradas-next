// Prueba en seco del agente contable: lee las facturas y dice qué haría. No escribe nada.
// npx tsx --env-file=.env.local scripts/agente-contable.ts
import { runAgenteContable } from "../lib/agente-contable";
import { MOTIVO_TEXTO, type MotivoParada } from "../lib/agente-contable-logic";

async function main() {
  const r = await runAgenteContable({ dryRun: true });
  if ("skipped" in r) return console.log(r.skipped);
  if (r.resultados.length === 0) return console.log("Ninguna factura pendiente.");
  for (const x of r.resultados) {
    const texto = x.estado === "lista" ? `LISTA nº ${x.numero} · base ${((x.baseCents ?? 0) / 100).toFixed(2)} €` : `PARADA ${MOTIVO_TEXTO[x.motivo as MotivoParada] || x.motivo} — ${x.detalle || ""}`;
    console.log(`${x.reference} · ${x.supplier}: ${texto}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

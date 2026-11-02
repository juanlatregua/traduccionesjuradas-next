/*
  VIGÍA DE PEDIDOS + AGENDA — CLI del agente .claude/agents/vigia-pedidos.md.
  Uso:  npx tsx --env-file=.env.local scripts/vigia-pedidos.ts [--dias=7] [--json]
  La lógica vive en lib/vigia.ts (la comparte el cron /api/cron/vigia-agenda).
*/
import { buildVigia, renderVigiaText } from "@/lib/vigia";

async function main() {
  // Los enlaces del informe se abren en producción, no en el localhost de .env.local.
  process.env.NEXTAUTH_URL = "https://www.traduccionesjuradas.net";
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  const v = await buildVigia(Number(args.dias || 7));
  console.log("json" in args ? JSON.stringify(v, null, 2) : renderVigiaText(v));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

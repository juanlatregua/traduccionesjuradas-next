// scripts/tarifario.ts — CLI del tarifario aprendido (agente de precios).
//   npx tsx --env-file=.env.local scripts/tarifario.ts                 # lista
//   npx tsx --env-file=.env.local scripts/tarifario.ts semillas        # siembra las tarifas dichas por Juan (25/26-ago)
//   npx tsx --env-file=.env.local scripts/tarifario.ts backfill        # aprende del historial (leads con precio + presupuestos pagados)
//   npx tsx --env-file=.env.local scripts/tarifario.ts aprobar <id>    # la puerta empieza a usarla
//   npx tsx --env-file=.env.local scripts/tarifario.ts vetar <id>
//   npx tsx --env-file=.env.local scripts/tarifario.ts fijar <id> --coste 25 --cliente 40 --plazo 2

import { prisma } from "../lib/prisma";
import { learnFromLeadPrice, learnFromPaidQuote, rateKeyLabel, recordSample } from "../lib/learned-rates";

const eur = (c: number | null | undefined) => (c == null ? "—" : `${(c / 100).toFixed(2)} €`);
const fecha = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");

async function list() {
  const rates = await prisma.learnedRate.findMany({
    orderBy: [{ status: "asc" }, { lang: "asc" }, { docType: "asc" }],
    include: { sampleRows: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (rates.length === 0) {
    console.log("Tarifario vacío. Ejecuta `semillas` y `backfill`.");
    return;
  }
  for (const status of ["APPROVED", "CANDIDATE", "VETOED"]) {
    const group = rates.filter((r) => r.status === status);
    if (group.length === 0) continue;
    console.log(`\n### ${status} (${group.length})`);
    for (const r of group) {
      console.log(
        `- [${r.id}] ${rateKeyLabel(r)} · coste ${eur(r.costCents)} · cliente ${eur(r.clientCents)} · ${r.miembroNombre || "sin jurado"}` +
          `${r.plazoDias ? ` · ${r.plazoDias} d` : ""} · ${r.samples} muestra${r.samples === 1 ? "" : "s"} · última ${fecha(r.lastSampleAt)}${r.wordsRef ? ` · ~${r.wordsRef} pal/doc` : ""}${r.note ? ` · ${r.note}` : ""}`
      );
      for (const s of r.sampleRows) {
        console.log(`    · ${fecha(s.createdAt)} ${s.kind} coste ${eur(s.costCents)} cliente ${eur(s.clientCents)}${s.words ? ` ${s.words} pal` : ""} ${s.leadRef || s.quoteId || s.orderRef || ""} ${s.note || ""}`);
      }
    }
  }
}

async function semillas() {
  // Dichas por Juan (memoria 25/26-ago-2026). Entran como CANDIDATE: las aprueba él.
  const seeds: Parameters<typeof recordSample>[] = [
    [
      { lang: "pt", direction: "to_es", docType: "criminal_record", apostille: true },
      { unit: "doc", kind: "seed", perUnit: true,costCents: 5050, miembroId: "rk1x2kq63rm6ba6mco7c6u2k", miembroNombre: "Juan Amor Fernández", note: "semilla Juan 25-ago: PT certificado apostillado 50,50 €/doc (Amor, 303/6)" },
    ],
    [
      { lang: "en", direction: "from_es", docType: "any", apostille: false },
      { unit: "kword", kind: "seed", perUnit: true,costCents: 8000, clientCents: 9500, plazoDias: 3, miembroId: "43dwlkzsr6lsltpwcj32m88s", miembroNombre: "Vanessa Bech", note: "semilla Juan 26-ago: EN 0,08 €/pal coste · 0,095 €/pal cliente (Vanessa)" },
    ],
    [
      { lang: "en", direction: "to_es", docType: "any", apostille: false },
      { unit: "kword", kind: "seed", perUnit: true,costCents: 8000, clientCents: 9500, plazoDias: 3, miembroId: "43dwlkzsr6lsltpwcj32m88s", miembroNombre: "Vanessa Bech", note: "semilla Juan 26-ago: EN 0,08 €/pal coste · 0,095 €/pal cliente (Vanessa)" },
    ],
    [
      { lang: "de", direction: "to_es", docType: "criminal_record", apostille: true },
      { unit: "doc", kind: "seed", perUnit: true,costCents: 2500, plazoDias: 1, miembroId: "ngus1uku6x5uw2pqbmflpbbt", miembroNombre: "Morton Sebastian Peter Münster", note: "semilla Juan 25-ago: DE penales + apostilla 25 €/doc (Morton); LEAD-E46D41F6CA 399 pal" },
    ],
    [
      { lang: "he", direction: "to_es", docType: "degree", apostille: false },
      { unit: "doc", kind: "seed", perUnit: true,costCents: 32000, clientCents: 43366, miembroId: "lk1bhu4l6f3vii81685l65ur", miembroNombre: "Cristina Herráez Llop", note: "semilla Juan 25-ago: HE título 320 €/doc (Cristina), cliente 320 + 12 % = 433,66 (Yafit)" },
    ],
  ];
  for (const [key, sample] of seeds) {
    const r = await recordSample(key, sample);
    console.log(`sembrada ${rateKeyLabel(key)} → ${r?.id} (${r?.status})`);
  }
}

async function reset() {
  const n = await prisma.learnedRate.deleteMany({});
  console.log(`tarifario vaciado: ${n.count} tarifas (y sus muestras)`);
}

async function backfill() {
  const leads = await prisma.lavoriPriceRequest.findMany({ where: { priceCents: { not: null } }, select: { id: true, ref: true } });
  for (const l of leads) {
    const r = await learnFromLeadPrice(l.id);
    console.log(`lead ${l.ref}: ${r.learned ? "aprendido" : `no (${r.reason})`}`);
  }
  const quotes = await prisma.quote.findMany({ where: { status: { in: ["PAID", "IN_PROGRESS", "DELIVERED"] } }, select: { id: true, quoteNumber: true } });
  for (const q of quotes) {
    const r = await learnFromPaidQuote(q.id);
    if (r.learned) console.log(`presupuesto ${q.quoteNumber}: ${r.learned} línea(s)`);
  }
}

async function setStatus(id: string, status: "APPROVED" | "VETOED") {
  const r = await prisma.learnedRate.update({ where: { id }, data: { status } });
  console.log(`${rateKeyLabel(r)} → ${status}`);
}

async function fijar(id: string, args: string[]) {
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? Number(args[i + 1]) : null;
  };
  const coste = get("--coste");
  const cliente = get("--cliente");
  const plazo = get("--plazo");
  const r = await prisma.learnedRate.findUniqueOrThrow({ where: { id } });
  await recordSample(
    { lang: r.lang, direction: r.direction as "to_es" | "from_es", docType: r.docType, apostille: r.apostille },
    {
      unit: r.unit as "doc" | "kword",
      kind: "manual",
      perUnit: true,
      costCents: coste != null ? Math.round(coste * 100) : null,
      clientCents: cliente != null ? Math.round(cliente * 100) : null,
      plazoDias: plazo != null ? Math.round(plazo) : null,
      note: "fijado a mano por CLI",
    }
  );
  console.log(`${rateKeyLabel(r)} actualizada (coste ${coste ?? "="}, cliente ${cliente ?? "="}, plazo ${plazo ?? "="})`);
}

(async () => {
  const [cmd, id, ...rest] = process.argv.slice(2);
  try {
    if (!cmd) await list();
    else if (cmd === "semillas") await semillas();
    else if (cmd === "backfill") await backfill();
    else if (cmd === "reset" && id === "--si") await reset();
    else if (cmd === "aprobar" && id) await setStatus(id, "APPROVED");
    else if (cmd === "vetar" && id) await setStatus(id, "VETOED");
    else if (cmd === "fijar" && id) await fijar(id, rest);
    else console.log("uso: tarifario.ts [semillas|backfill|aprobar <id>|vetar <id>|fijar <id> --coste N --cliente N --plazo N]");
  } finally {
    await prisma.$disconnect();
  }
})();

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const eur = (c: number) => `${(c / 100).toFixed(2)} €`;
const d = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

(async () => {
  const desde = Math.floor(new Date("2026-06-01").getTime() / 1000);
  const payouts = await stripe.payouts.list({ created: { gte: desde }, limit: 100 });
  console.log(`PAYOUTS DE STRIPE desde el 1-jun (${payouts.data.length}):\n`);
  let totalBruto = 0, totalCom = 0, totalNeto = 0;
  for (const p of payouts.data.reverse()) {
    const txs = await stripe.balanceTransactions.list({ payout: p.id, limit: 100, expand: ["data.source"] });
    const cargos = txs.data.filter((t) => t.type === "charge" || t.type === "payment");
    const bruto = cargos.reduce((a, t) => a + t.amount, 0);
    const com = cargos.reduce((a, t) => a + t.fee, 0);
    console.log(`${d(p.arrival_date)} · payout ${p.id} · llega al banco ${eur(p.amount)} · ${p.status}`);
    console.log(`   ${cargos.length} cobro(s) · bruto ${eur(bruto)} · comisión ${eur(com)}`);
    for (const t of cargos) {
      const src: any = t.source;
      const desc = src?.description || src?.metadata?.orderReference || src?.metadata?.quoteId || t.description || "";
      console.log(`     ${d(t.created)} ${eur(t.amount).padStart(10)} − ${eur(t.fee)} = ${eur(t.net)}  ${String(desc).slice(0, 46)}`);
    }
    totalBruto += bruto; totalCom += com; totalNeto += p.amount;
  }
  console.log(`\nTOTAL desde junio: bruto ${eur(totalBruto)} · comisión ${eur(totalCom)} · ingresado ${eur(totalNeto)}`);
})();

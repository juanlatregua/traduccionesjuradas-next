// SOLO LECTURA. Desglosa cada payout de Stripe (= línea "LIQ. OP." del BBVA) en
// sus cargos: bruto, comisión, neto, cliente y metadata (pedido/presupuesto).
import { readFileSync } from "node:fs";
function key(n){ for(const f of[".env.local",".env"]){try{const m=readFileSync(f,"utf8").match(new RegExp(`^${n}=(.*)$`,"m"));if(m){let v=m[1].trim();if((v[0]=='"'&&v.endsWith('"'))||(v[0]=="'"&&v.endsWith("'")))v=v.slice(1,-1);if(v)return v;}}catch{}}return"";}
const Stripe=(await import("stripe")).default;
const s=new Stripe(key("STRIPE_SECRET_KEY"));
const eur=c=>(c/100).toFixed(2);
const D=ts=>new Date(ts*1000).toISOString().slice(0,10);
const gte=Math.floor(Date.UTC(2026,3,1)/1000), lt=Math.floor(Date.UTC(2026,6,1)/1000);
const payouts=(await s.payouts.list({ arrival_date:{gte,lt}, limit:100 })).data.sort((a,b)=>a.arrival_date-b.arrival_date);
let grandGross=0, grandFee=0, grandNet=0;
for(const p of payouts){
  console.log(`\n===== PAYOUT ${D(p.arrival_date)}  neto ${eur(p.amount)} € (${p.status})  ${p.id} =====`);
  const bts=(await s.balanceTransactions.list({ payout:p.id, limit:100, expand:["data.source"] })).data;
  let gross=0, fee=0, net=0;
  for(const bt of bts){
    gross+=bt.amount; fee+=bt.fee; net+=bt.net;
    const src=bt.source||{};
    const md=src.metadata||{};
    const ref=md.reference||md.orderReference||md.orderId||md.quoteId||md.quoteReference||"";
    const email=src.receipt_email||src.billing_details?.email||(src.customer_details?.email)||"";
    const desc=(src.description||bt.description||"").slice(0,40);
    console.log(`   ${bt.type.padEnd(10)} bruto ${eur(bt.amount).padStart(8)}  comis ${eur(-bt.fee).padStart(7)}  neto ${eur(bt.net).padStart(8)}  ${(ref||"—").padEnd(20)} ${email.padEnd(28)} ${desc}`);
  }
  console.log(`   ── payout: bruto ${eur(gross)}  comisión ${eur(-fee)}  neto ${eur(net)}  (${bts.length} mov.)`);
  grandGross+=gross; grandFee+=fee; grandNet+=net;
}
console.log(`\n### TOTAL ${payouts.length} payouts: bruto ${eur(grandGross)} · comisión ${eur(-grandFee)} · neto a BBVA ${eur(grandNet)} €`);

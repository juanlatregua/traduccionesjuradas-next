// SOLO LECTURA. Todos los cargos de Stripe abr-jun, con reembolsos, payout (→BBVA)
// y cruce con pedidos/presupuestos de la BD por importe/email.
import { readFileSync } from "node:fs";
function key(n){ for(const f of[".env.local",".env"]){try{const m=readFileSync(f,"utf8").match(new RegExp(`^${n}=(.*)$`,"m"));if(m){let v=m[1].trim();if((v[0]=='"'&&v.endsWith('"'))||(v[0]=="'"&&v.endsWith("'")))v=v.slice(1,-1);if(v)return v;}}catch{}}return"";}
process.env.DATABASE_URL=key("DATABASE_URL");
const Stripe=(await import("stripe")).default;
const s=new Stripe(key("STRIPE_SECRET_KEY"));
const { PrismaClient }=await import("@prisma/client");
const p=new PrismaClient();
const eur=c=>(c/100).toFixed(2);
const D=ts=>new Date(ts*1000).toISOString().slice(0,10);
const gte=Math.floor(Date.UTC(2026,3,1)/1000), lt=Math.floor(Date.UTC(2026,6,1)/1000);

// mapa balance_txn -> payout arrival (para saber si el cargo llegó al BBVA y cuándo)
const payouts=(await s.payouts.list({ arrival_date:{gte,lt}, limit:100 })).data;
const btToPayout=new Map();
for(const po of payouts){
  let more=true, sf;
  while(more){ const r=await s.balanceTransactions.list({ payout:po.id, limit:100, starting_after:sf }); for(const bt of r.data) btToPayout.set(bt.id,po); more=r.has_more; if(r.data.length) sf=r.data[r.data.length-1].id; }
}

// pedidos/presupuestos PAID de la BD
const orders=await p.order.findMany({ where:{ paymentStatus:"PAID" }, select:{reference:true,amountCents:true,clientEmail:true,clientName:true,paidAt:true,source:true} });
const byCents=new Map(); for(const o of orders){ (byCents.get(o.amountCents)||byCents.set(o.amountCents,[]).get(o.amountCents)).push(o); }

const charges=[];
let sf;
for(;;){ const r=await s.charges.list({ created:{gte,lt}, limit:100, starting_after:sf }); charges.push(...r.data); if(!r.has_more) break; sf=r.data[r.data.length-1].id; }
charges.sort((a,b)=>a.created-b.created);

console.log(`Cargos Stripe abr-jun: ${charges.length}\n`);
console.log("FECHA       IMPORTE  ESTADO     REEMB   PAYOUT→BBVA   EMAIL                          PEDIDO BD (por importe)");
for(const c of charges){
  const email=c.receipt_email||c.billing_details?.email||"";
  const po=btToPayout.get(c.balance_transaction);
  const payoutInfo=po?`${D(po.arrival_date)} ${eur(po.amount)}`:"(no en ventana)";
  const refunded=c.amount_refunded>0?`-${eur(c.amount_refunded)}`:"";
  const cand=(byCents.get(c.amount)||[]).map(o=>`${o.reference}${o.clientName?"/"+o.clientName.slice(0,14):""}`).join(" | ")||(c.status==="succeeded"&&!c.refunded?"⚠ sin pedido igual":"");
  console.log(`${D(c.created)}  ${eur(c.amount).padStart(7)}  ${c.status.padEnd(9)} ${refunded.padStart(7)}  ${payoutInfo.padEnd(13)} ${email.padEnd(30)} ${cand}`);
}
await p.$disconnect();

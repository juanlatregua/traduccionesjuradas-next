// SOLO LECTURA. Exporta los movimientos de Stripe del 2T para el asesor:
// por payout (=línea BBVA): bruto, comisión, neto; y por cargo: cliente, factura.
// Además saca el país/entidad de la cuenta Stripe (para el tratamiento del IVA de la comisión).
import { readFileSync, writeFileSync } from "node:fs";
function key(n){ for(const f of[".env.local",".env"]){try{const m=readFileSync(f,"utf8").match(new RegExp(`^${n}=(.*)$`,"m"));if(m){let v=m[1].trim();if((v[0]=='"'&&v.endsWith('"'))||(v[0]=="'"&&v.endsWith("'")))v=v.slice(1,-1);if(v)return v;}}catch{}}return"";}
const Stripe=(await import("stripe")).default; const s=new Stripe(key("STRIPE_SECRET_KEY"));
const eur=c=>(c/100).toFixed(2).replace(".",",");
const D=ts=>new Date(ts*1000).toISOString().slice(0,10);
const gte=Math.floor(Date.UTC(2026,3,1)/1000), lt=Math.floor(Date.UTC(2026,6,1)/1000);

const acct=await s.accounts.retrieve();
console.log(`CUENTA STRIPE: país=${acct.country} · entidad Stripe que factura la comisión = Stripe Payments Europe, Ltd (Irlanda) para cuentas UE`);

const payouts=(await s.payouts.list({ arrival_date:{gte,lt}, limit:100 })).data.sort((a,b)=>a.arrival_date-b.arrival_date);
const cell=v=>{const t=String(v??"");return /[";\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;};
const rows=[["Fecha payout (BBVA)","Payout Stripe","Cargo/cliente","Fecha cargo","Bruto €","Comisión €","Neto €","Tipo"].join(";")];
let TB=0,TF=0,TN=0;
for(const po of payouts){
  const bts=(await s.balanceTransactions.list({ payout:po.id, limit:100, expand:["data.source"] })).data;
  for(const bt of bts){
    if(bt.type==="payout") continue;
    const src=bt.source||{}; const email=src.receipt_email||src.billing_details?.email||"";
    TB+=bt.amount; TF+=bt.fee; TN+=bt.net;
    rows.push([D(po.arrival_date),po.id,email||bt.description||"",src.created?D(src.created):"",eur(bt.amount),eur(-bt.fee),eur(bt.net),bt.type].map(cell).join(";"));
  }
  rows.push([D(po.arrival_date),po.id,"— NETO PAYOUT →","", "","",eur(po.amount),"payout→BBVA"].map(cell).join(";"));
}
rows.push(["","","TOTALES 2T","",eur(TB),eur(-TF),eur(TN),""].map(cell).join(";"));
const out="/Users/nip/Desktop/2trimestres/banco BBVA/stripe-movimientos-2T.csv";
writeFileSync(out,"﻿"+rows.join("\r\n"));
console.log(`\n✓ ${out}`);
console.log(`\nRESUMEN 2T:  bruto cobrado ${eur(TB)} €  ·  COMISIÓN STRIPE (gasto) ${eur(TF)} €  ·  neto al BBVA ${eur(TN)} €`);
console.log(`Comisión por mes:`);
const byMonth={};
for(const po of payouts){ const m=D(po.arrival_date).slice(0,7); const bts=(await s.balanceTransactions.list({payout:po.id,limit:100})).data; for(const bt of bts){ if(bt.type!=="payout"){ byMonth[m]=(byMonth[m]||0)+bt.fee; } } }
for(const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${eur(byMonth[m])} €`);

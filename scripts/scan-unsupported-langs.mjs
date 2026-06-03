import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const SUPPORTED = new Set(["fr","en","de","nl","it","pt","ca","sv","no","ar","ro","es"]);
const base = (lp) => { const s=String(lp||"").toLowerCase().replace(/->/g,"-"); if(s.includes("-")){const [f,t]=s.split("-"); if(f==="es"&&t) return t; if(t==="es"&&f) return f; return f;} return s; };

console.log("=== ORDERS con langPair de idioma NO soportado (histórico completo) ===");
const orders = await prisma.order.findMany({ orderBy:{createdAt:"asc"}, select:{reference:true,createdAt:true,langPair:true,amountCents:true,status:true,paymentStatus:true,clientEmail:true,source:true} });
let n=0;
for (const o of orders){ const b=base(o.langPair); if(o.langPair && !SUPPORTED.has(b)){ n++; console.log(`  ${o.reference} | ${o.createdAt.toISOString().slice(0,10)} | langPair=${o.langPair} (base=${b}) | ${(o.amountCents??0)/100}€ | ${o.status}/${o.paymentStatus} | ${o.clientEmail}`);} }
console.log(`  → ${n} de ${orders.length} pedidos con idioma no soportado`);

console.log("\n=== DocumentAnalysis con sourceLanguage NO soportado ===");
const das = await prisma.documentAnalysis.findMany({ orderBy:{createdAt:"asc"}, select:{id:true,createdAt:true,sourceLanguage:true,countryOrigin:true,quoteAmount:true,status:true,orderReference:true,clientEmail:true} });
let m=0;
for (const d of das){ const s=String(d.sourceLanguage||"").toLowerCase(); if(d.sourceLanguage && !SUPPORTED.has(s)){ m++; console.log(`  [${d.id.slice(0,8)}] ${d.createdAt.toISOString().slice(0,10)} | src=${d.sourceLanguage} country=${d.countryOrigin} | quote=${d.quoteAmount}€ | ${d.status} | order=${d.orderReference||"—"} | ${d.clientEmail||"—"}`);} }
console.log(`  → ${m} de ${das.length} análisis con idioma no soportado`);
await prisma.$disconnect();

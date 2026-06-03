// scripts/gsc-cannibalization.mjs — Mapa de canibalización SEO: para cada par
// thin↔canónico, top queries de cada uno + queries COMPARTIDAS (90d, GSC API).
// Detecta si dos URLs compiten por las mismas keywords antes de fusionar/redirigir.
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
const ROOT="/Users/juan/Code/HBTJ/traduccionesjuradas-net";
const SITE="sc-domain:traduccionesjuradas.net", BASE="https://www.traduccionesjuradas.net";
const env=readFileSync(ROOT+"/.env.local","utf8");
const sa=JSON.parse(env.match(/GOOGLE_VISION_SERVICE_ACCOUNT_JSON='([\s\S]+?)'\n/)[1]);
const b64u=s=>Buffer.from(s).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const now=Math.floor(Date.now()/1000);
const input=b64u(JSON.stringify({alg:"RS256",typ:"JWT"}))+"."+b64u(JSON.stringify({iss:sa.client_email,scope:"https://www.googleapis.com/auth/webmasters.readonly",aud:"https://oauth2.googleapis.com/token",exp:now+3600,iat:now}));
const s=createSign("RSA-SHA256");s.update(input);
const sig=s.sign(sa.private_key,"base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const tr=await(await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:input+"."+sig})})).json();
const end=new Date(Date.now()-2*864e5).toISOString().slice(0,10), start=new Date(Date.now()-92*864e5).toISOString().slice(0,10);
const data=await(await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,{method:"POST",headers:{Authorization:"Bearer "+tr.access_token,"Content-Type":"application/json"},body:JSON.stringify({startDate:start,endDate:end,dimensions:["page","query"],rowLimit:25000})})).json();
const rows=data.rows||[];
const pages={
 "estatutos→mercantiles":["/traduccion-jurada-de-estatutos-sociales","/documentos-oficiales/documentos-mercantiles"],
 "antecedentes":["/traduccion-jurada-antecedentes-penales","/documentos-oficiales/antecedentes-penales"],
 "permiso→laborales":["/traduccion-jurada-permiso-de-conducir","/documentos-oficiales/documentos-laborales"],
 "sentencia→juridicos":["/traduccion-jurada-sentencia-judicial","/documentos-oficiales/documentos-juridicos"],
 "segsocial→laborales":["/traduccion-jurada-de-certificado-de-seguridad-social","/documentos-oficiales/documentos-laborales"],
};
const top=(slug)=>rows.filter(r=>r.keys[0]===BASE+slug||r.keys[0]===BASE+slug+"/").sort((a,b)=>b.impressions-a.impressions).slice(0,6).map(r=>`        "${r.keys[1]}" impr=${r.impressions} pos=${r.position.toFixed(0)}`);
for(const [name,[thin,canon]] of Object.entries(pages)){
  console.log(`\n### ${name}`);
  const tq=top(thin), cq=top(canon);
  console.log(`  THIN ${thin}:`); console.log(tq.length?tq.join("\n"):"        (sin queries)");
  console.log(`  CANON ${canon}:`); console.log(cq.length?cq.join("\n"):"        (sin queries)");
  const ts=new Set(rows.filter(r=>r.keys[0]===BASE+thin||r.keys[0]===BASE+thin+"/").map(r=>r.keys[1]));
  const overlap=[...new Set(rows.filter(r=>r.keys[0]===BASE+canon||r.keys[0]===BASE+canon+"/").map(r=>r.keys[1]))].filter(q=>ts.has(q));
  console.log(`  ⚠ QUERIES COMPARTIDAS (canibalización real): ${overlap.length?overlap.join(" | "):"NINGUNA"}`);
}

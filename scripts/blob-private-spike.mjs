// scripts/blob-private-spike.mjs
// FASE 0 de D (privatización de blobs): verifica en VIVO que @vercel/blob 2.4.1
// sirve blobs PRIVADOS de verdad en este proyecto Vercel. Es el único paso del
// spike que no se puede comprobar solo con tipos: hay que tocar el store real.
//
// Ejecutar (con el token de prod o de un store de pruebas):
//   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/blob-private-spike.mjs
//
// Crea un fichero diminuto, comprueba que la URL directa NO es accesible sin
// auth (privado), que get(access:'private') SÍ lo lee server-side, y lo borra.
// No deja rastro. Si el "fetch directo" devuelve 200, el privado NO está activo.

import { put, get, del } from "@vercel/blob";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN en el entorno.");
  process.exit(1);
}

const pathname = `spike/private-test-${Date.now()}.txt`;
const body = "spike privado D — se autoborra";

let url;
try {
  const blob = await put(pathname, body, { access: "private", addRandomSuffix: true });
  url = blob.url;
  console.log("1) PUT access:'private' OK →", url);

  // 2) Acceso DIRECTO a la URL, sin credenciales → debe fallar (401/403) si es privado.
  const direct = await fetch(url);
  const blocked = direct.status === 401 || direct.status === 403;
  console.log(`2) fetch directo sin auth → HTTP ${direct.status} ${blocked ? "✅ BLOQUEADO (privado real)" : "⚠️ ACCESIBLE — el privado NO está activo"}`);

  // 3) Lectura autenticada server-side con get(access:'private') → debe funcionar.
  const res = await get(url, { access: "private", useCache: false });
  const text = res?.stream ? await new Response(res.stream).text() : null;
  console.log(`3) get(access:'private') → ${text === body ? "✅ leído con auth" : `⚠️ inesperado: ${JSON.stringify(text)}`}`);

  console.log(`\nVEREDICTO: ${blocked && text === body ? "✅ El acceso privado funciona → D puede avanzar a Fase 1 (proxy)." : "⚠️ Revisar config del store/plan Vercel antes de seguir."}`);
} finally {
  if (url) {
    await del(url).then(() => console.log("4) DEL OK — spike limpio")).catch((e) => console.error("No se pudo borrar el blob de prueba:", e?.message));
  }
}

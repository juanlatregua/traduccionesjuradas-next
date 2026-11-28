// Proxy autorizado de los blobs PRIVADOS (paso a privado, RGPD). La ruta es el
// pathname del blob en la tienda privada; la credencial va en el query
// (?ref&t cliente · ?a colaborador · ?q presupuesto · sin nada, staff) y solo
// abre lo que la BD ata a ese pedido o presupuesto. Ver lib/file-proxy-auth.ts.

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { blobHostFromToken } from "@/lib/blob-hosts";
import { FILE_PROXY_PREFIX, readBlob } from "@/lib/blob-store";
import { authorizeFile, blobUrlFromProxyPath } from "@/lib/file-proxy-auth";
import { fileProxyDeps } from "@/lib/file-proxy-db";
import { safeDocName } from "@/lib/pdf-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `files:${ip}`, limit: 120, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return deny(429, "Demasiadas peticiones. Espera unos minutos.");

  const reqUrl = new URL(req.url);
  const privateHost = blobHostFromToken(process.env.BLOB_PRIVATE_READ_WRITE_TOKEN, "private");
  const blobUrl = blobUrlFromProxyPath(reqUrl.pathname.slice(FILE_PROXY_PREFIX.length), privateHost);
  if (!blobUrl) return deny(404, "Documento no disponible.");

  const auth = await authorizeFile(blobUrl, reqUrl.searchParams, fileProxyDeps(req));
  if (!auth.ok) return deny(auth.status, auth.status === 401 ? "Inicia sesión." : "Acceso denegado.");

  const res = await readBlob(blobUrl);
  if (!res.ok || !res.body) return deny(404, "Documento no disponible.");

  const segments = reqUrl.pathname.split("/");
  let fileName = "documento";
  try {
    fileName = decodeURIComponent(segments[segments.length - 1] || "documento");
  } catch {}
  const contentType = (res.headers.get("content-type") || "application/octet-stream").toLowerCase();
  const inlineSafe = /^(application\/pdf|image\/(png|jpe?g|webp|gif|heic|heif|tiff))\b/.test(contentType);
  const download = reqUrl.searchParams.get("download") === "1" || !inlineSafe;
  const headers = new Headers({
    ...NO_STORE,
    "Content-Type": inlineSafe ? contentType : "application/octet-stream",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeDocName(fileName)}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  });
  const len = res.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new NextResponse(res.body, { status: 200, headers });
}

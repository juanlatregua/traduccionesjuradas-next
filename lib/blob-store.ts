// Única puerta de escritura/lectura de documentos en Vercel Blob durante el paso
// a privado (RGPD). Con BLOB_PRIVADO apagado todo se comporta como hoy: put
// público con sufijo aleatorio y fetch directo de la URL.
// Sin alias "@/": lo importan módulos que se prueban con node --test.

import { get, put, type PutBlobResult, type PutCommandOptions } from "@vercel/blob";
import { isOurPrivateBlob } from "./blob-hosts.ts";

export { isOurBlobHost, isOwnStoreUrl, isOurPrivateBlob } from "./blob-hosts.ts";

type Env = Record<string, string | undefined>;

export function blobPrivadoOn(env: Env = process.env): boolean {
  if (env.BLOB_PRIVADO !== "on") return false;
  if (!env.BLOB_PRIVATE_READ_WRITE_TOKEN) {
    console.error("[blob-store] BLOB_PRIVADO=on sin BLOB_PRIVATE_READ_WRITE_TOKEN: sigo en público");
    return false;
  }
  return true;
}

type PutBody = Parameters<typeof put>[1];
export type PutDocOptions = Omit<PutCommandOptions, "access" | "token" | "addRandomSuffix">;

export async function putDoc(pathname: string, body: PutBody, opts: PutDocOptions = {}): Promise<PutBlobResult> {
  if (blobPrivadoOn()) {
    return put(pathname, body, {
      ...opts,
      access: "private",
      addRandomSuffix: true,
      token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN,
    });
  }
  return put(pathname, body, { ...opts, access: "public", addRandomSuffix: true });
}

/**
 * Lee un blob en el servidor como Response. Tienda privada nuestra → get con el
 * token privado; cualquier otra URL → fetch tal cual (comportamiento de hoy).
 */
export async function readBlob(url: string, init?: RequestInit): Promise<Response> {
  const privateToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (!isOurPrivateBlob(url, privateToken)) return fetch(url, init);
  try {
    const r = await get(url, {
      access: "private",
      token: privateToken,
      useCache: false,
      abortSignal: init?.signal ?? undefined,
    });
    if (!r || r.statusCode !== 200) return new Response(null, { status: 404 });
    const headers = new Headers({ "Content-Type": r.blob.contentType || "application/octet-stream" });
    if (Number.isFinite(r.blob.size)) headers.set("Content-Length", String(r.blob.size));
    return new Response(r.stream, { status: 200, headers });
  } catch (e) {
    console.error("[blob-store] get privado falló", (e as Error)?.message);
    return new Response(null, { status: 502 });
  }
}

export type FileAudience =
  | { kind: "staff" }
  | { kind: "client"; reference: string; token: string }
  | { kind: "collaborator"; token: string }
  | { kind: "quote"; token: string };

export const FILE_PROXY_PREFIX = "/api/files/";

/** Enlace a un documento: apagado o blob público → la URL tal cual; privado → el proxy autorizado. */
export function fileLink(
  url: string,
  audiencia: FileAudience,
  opts: { download?: boolean; base?: string } = {}
): string {
  if (!blobPrivadoOn() || !isOurPrivateBlob(url, process.env.BLOB_PRIVATE_READ_WRITE_TOKEN)) return url;
  const u = new URL(url);
  const qs = new URLSearchParams();
  if (audiencia.kind === "client") {
    qs.set("ref", audiencia.reference);
    qs.set("t", audiencia.token);
  } else if (audiencia.kind === "collaborator") {
    qs.set("a", audiencia.token);
  } else if (audiencia.kind === "quote") {
    qs.set("q", audiencia.token);
  }
  if (opts.download) qs.set("download", "1");
  const q = qs.toString();
  return `${opts.base || ""}${FILE_PROXY_PREFIX}${u.pathname.replace(/^\//, "")}${q ? `?${q}` : ""}`;
}

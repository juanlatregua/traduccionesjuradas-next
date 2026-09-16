"use client";

// Subida de ficheros del STAFF directa del navegador a Vercel Blob. El fichero no
// pasa por la función, así que no le afecta el tope de 4,5 MB de Vercel: por
// /api/upload los ficheros grandes volvían «Request Entity Too Large» en texto
// plano y la pantalla mostraba «Unexpected token 'R'» (entregas y justificantes,
// 16-sep-2026). El token lo da /api/documents/upload (staff: Word, hasta 50 MB,
// sufijo aleatorio). /api/upload sigue vivo solo para DELETE.

import { upload } from "@vercel/blob/client";

export type StaffUploaded = { url: string; pathname: string; name: string };

export async function uploadStaffFile(file: File, prefix: string): Promise<StaffUploaded> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "fichero";
  try {
    const blob = await upload(`${prefix}/${Date.now()}-${safeName}`, file, {
      access: "public",
      handleUploadUrl: "/api/documents/upload",
      clientPayload: JSON.stringify({ gdprConsent: true }),
    });
    return { url: blob.url, pathname: blob.pathname, name: file.name };
  } catch (err: any) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`No se pudo subir ${file.name} (${mb} MB): ${err?.message || "error de subida"}.`);
  }
}

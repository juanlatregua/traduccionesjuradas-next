// Reglas puras para abrir ZIPs de clientes (lib/expediente-unzip.ts).
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export function isZipDocument(d: { fileName?: string | null; mimeType?: string | null }) {
  return /zip/i.test(String(d.mimeType || "")) || /\.zip$/i.test(String(d.fileName || ""));
}

// macOS y Windows guardan los nombres en UTF-8 sin marcarlo, o en CP437/latin1.
export function decodeZipName(bytes: Uint8Array | string): string {
  if (typeof bytes === "string") return bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

export function usableZipEntry(path: string): { name: string; mimeType: string } | null {
  const parts = path.split("/").filter(Boolean);
  const name = parts[parts.length - 1] || "";
  if (!name || parts.some((p) => p === "__MACOSX") || name.startsWith(".") || name.startsWith("._")) return null;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_BY_EXT[ext];
  return mimeType ? { name: name.normalize("NFC"), mimeType } : null;
}

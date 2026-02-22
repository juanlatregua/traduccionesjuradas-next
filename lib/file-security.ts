const PAYMENT_PROOF_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const GENERAL_UPLOAD_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "txt",
]);

function getExtension(name: string) {
  const safe = String(name || "").trim().toLowerCase();
  const idx = safe.lastIndexOf(".");
  if (idx < 0) return "";
  return safe.slice(idx + 1);
}

export function sanitizeFileName(name: string) {
  const trimmed = String(name || "").trim();
  const base = trimmed.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_");
  const normalized = base.replace(/_+/g, "_");
  const finalName = normalized || "archivo";
  return finalName.slice(0, 120);
}

async function readHead(file: File, size = 16) {
  const chunk = await file.slice(0, size).arrayBuffer();
  return new Uint8Array(chunk);
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function sniff(bytes: Uint8Array) {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  const isRiff =
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isRiff) return "image/webp";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  return null;
}

export async function validatePaymentProofFile(file: File) {
  const ext = getExtension(file.name);
  if (!PAYMENT_PROOF_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Extension no permitida para comprobante." as const };
  }

  const detected = sniff(await readHead(file));
  if (!detected) {
    return { ok: false, error: "No se pudo verificar el tipo real del archivo." as const };
  }

  const extToMime: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  if (detected !== extToMime[ext]) {
    return { ok: false, error: "El contenido del archivo no coincide con su extension." as const };
  }

  if (file.type && file.type !== detected) {
    return { ok: false, error: "El tipo MIME declarado no coincide con el contenido." as const };
  }

  return { ok: true as const, safeName: sanitizeFileName(file.name), detectedMime: detected };
}

export async function validateGeneralUploadFile(file: File) {
  const ext = getExtension(file.name);
  if (!GENERAL_UPLOAD_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Extension no permitida." as const };
  }

  const detected = sniff(await readHead(file));
  const safeName = sanitizeFileName(file.name);

  if (ext === "docx") {
    if (detected && detected !== "application/zip") {
      return { ok: false, error: "Archivo DOCX invalido." as const };
    }
    return { ok: true as const, safeName };
  }

  if (ext === "doc") {
    return { ok: true as const, safeName };
  }

  if (ext === "txt") {
    if (detected) {
      return { ok: false, error: "El archivo TXT contiene formato binario no permitido." as const };
    }
    return { ok: true as const, safeName };
  }

  const extToMime: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };

  if (!detected || detected !== extToMime[ext]) {
    return { ok: false, error: "El contenido del archivo no coincide con su extension." as const };
  }

  if (file.type && file.type !== detected) {
    return { ok: false, error: "El tipo MIME declarado no coincide con el contenido." as const };
  }

  return { ok: true as const, safeName };
}


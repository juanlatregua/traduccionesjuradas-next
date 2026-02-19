import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWordRateForLangOrPair } from "@/lib/pricing";
import { analyzeDocumentForBudget, normalizeOcrText } from "@/lib/ai-document";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);
const SAFETY_MARGIN_MULTIPLIER = 1.1;
const SAFETY_MARGIN_PCT = 10;

type Urgency = "normal" | "urgente24";

function getOcrLanguage(langOrPair: string) {
  const normalized = String(langOrPair || "").toLowerCase();
  const source = normalized.includes("-") ? normalized.split("-")[0] : normalized;
  switch (source) {
    case "es":
      return "spa";
    case "en":
      return "eng";
    case "fr":
      return "fre";
    case "de":
      return "ger";
    case "it":
      return "ita";
    case "pt":
      return "por";
    case "nl":
      return "dut";
    case "sv":
      return "swe";
    case "no":
      return "nor";
    case "ca":
      return "spa";
    default:
      return "eng";
  }
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function looksLikePdfTechnicalGarbage(text: string) {
  if (!text) return true;
  const sample = text.slice(0, 5000);

  const suspiciousTokens = [
    "/Type",
    "/XObject",
    "/Subtype",
    "/Filter",
    "/DecodeParms",
    "CCITTFaxDecode",
    "FlateDecode",
    "BitsPerComponent",
    "ImageMask",
    "Creator (",
    "CreationDate",
  ];

  const suspiciousHits = suspiciousTokens.reduce(
    (acc, token) => acc + (sample.includes(token) ? 1 : 0),
    0
  );

  const weirdChars = (sample.match(/[ÿþ]/g) || []).length;
  const letters = (sample.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const letterRatio = letters / Math.max(1, sample.length);

  return suspiciousHits >= 3 || weirdChars >= 10 || letterRatio < 0.35;
}

function getFileExtension(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

async function extractTextWithOcrSpace(
  fileBuffer: Buffer,
  fileName: string,
  fileType: string,
  ocrLanguage: string
) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "OCR_SPACE_API_KEY no configurada." };
  }

  try {
    const form = new FormData();
    form.append("language", ocrLanguage);
    form.append("isOverlayRequired", "false");
    const fileBytes = new Uint8Array(fileBuffer);
    form.append("file", new Blob([fileBytes], { type: fileType || "application/pdf" }), fileName);

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: apiKey,
      },
      body: form,
    });

    if (!res.ok) {
      return { ok: false as const, error: `OCR.Space HTTP ${res.status}` };
    }
    const data = (await res.json()) as any;
    if (data?.IsErroredOnProcessing) {
      const msg =
        data?.ErrorMessage?.join?.(" ") ||
        data?.ErrorMessage ||
        data?.ErrorDetails ||
        "OCR.Space devolvió error de procesamiento.";
      return { ok: false as const, error: String(msg) };
    }
    const parsedArr = Array.isArray(data?.ParsedResults) ? data.ParsedResults : [];
    const text = parsedArr
      .map((p: any) => String(p?.ParsedText || ""))
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      return { ok: false as const, error: "OCR.Space no devolvió texto." };
    }
    return { ok: true as const, text, method: "ocr-space" as const };
  } catch {
    return { ok: false as const, error: "No se pudo conectar con OCR.Space." };
  }
}

async function extractPdfTextWithOcrSpaceByPages(
  pdfBuffer: Buffer,
  baseName: string,
  ocrLanguage: string
) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "estimador-ocr-"));
  const pdfPath = path.join(tmpDir, `${baseName || "input"}.pdf`);
  const prefix = path.join(tmpDir, "page");
  try {
    await fs.writeFile(pdfPath, pdfBuffer);

    // Genera JPG por página para evitar el límite de 1MB por archivo del plan gratuito.
    await execFileAsync("pdftoppm", ["-jpeg", "-r", "110", "-f", "1", "-l", "8", pdfPath, prefix]);

    const names = (await fs.readdir(tmpDir))
      .filter((n) => /^page-\d+\.jpg$/i.test(n))
      .sort((a, b) => {
        const na = Number(a.match(/\d+/)?.[0] || 0);
        const nb = Number(b.match(/\d+/)?.[0] || 0);
        return na - nb;
      });

    if (names.length === 0) {
      return { ok: false as const, error: "No se pudieron generar páginas para OCR." };
    }

    const chunks: string[] = [];
    for (const n of names) {
      const pagePath = path.join(tmpDir, n);
      const pageBuffer = await fs.readFile(pagePath);
      const out = await extractTextWithOcrSpace(pageBuffer, n, "image/jpeg", ocrLanguage);
      if (out.ok && out.text) chunks.push(out.text);
    }

    const text = chunks.join(" ").replace(/\s+/g, " ").trim();
    if (!text) {
      return { ok: false as const, error: "OCR por páginas no devolvió texto." };
    }
    return { ok: true as const, text, method: "ocr-space-pages" as const };
  } catch (err: any) {
    return {
      ok: false as const,
      error: err?.message || "Fallo en OCR por páginas.",
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function getGoogleVisionApiKey() {
  return process.env.GOOGLE_VISION_API_KEY || "";
}

function parseGoogleServiceAccount(): GoogleServiceAccount | null {
  const raw = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON || "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GoogleServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      ...parsed,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function base64Url(input: string | Buffer) {
  const buff = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buff
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGoogleAccessTokenFromServiceAccount() {
  const sa = parseGoogleServiceAccount();
  if (!sa) return null;

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const tokenUrl = sa.token_uri || "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token?: string };
  return data.access_token || null;
}

function toVisionLanguageHint(ocrLanguage: string) {
  switch (ocrLanguage) {
    case "spa":
      return "es";
    case "eng":
      return "en";
    case "fre":
      return "fr";
    case "ger":
      return "de";
    case "ita":
      return "it";
    case "por":
      return "pt";
    case "dut":
      return "nl";
    case "swe":
      return "sv";
    case "nor":
      return "no";
    default:
      return "en";
  }
}

async function extractTextWithGoogleVisionImage(
  imageBuffer: Buffer,
  ocrLanguage: string
) {
  const accessToken = await getGoogleAccessTokenFromServiceAccount();
  const apiKey = getGoogleVisionApiKey();
  if (!accessToken && !apiKey) {
    return {
      ok: false as const,
      error: "Falta configurar GOOGLE_VISION_SERVICE_ACCOUNT_JSON o GOOGLE_VISION_API_KEY.",
    };
  }

  try {
    const payload = {
      requests: [
        {
          image: { content: imageBuffer.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: {
            languageHints: [toVisionLanguageHint(ocrLanguage)],
          },
        },
      ],
    };

    const endpoint = apiKey
      ? `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`
      : "https://vision.googleapis.com/v1/images:annotate";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false as const, error: `Google Vision HTTP ${res.status}` };
    }
    const data = (await res.json()) as any;
    const text = String(data?.responses?.[0]?.fullTextAnnotation?.text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      const errMsg = data?.responses?.[0]?.error?.message;
      return { ok: false as const, error: errMsg || "Google Vision no devolvio texto." };
    }
    return { ok: true as const, text, method: "google-vision" as const };
  } catch {
    return { ok: false as const, error: "No se pudo conectar con Google Vision." };
  }
}

async function extractPdfTextWithGoogleVision(
  pdfBuffer: Buffer,
  ocrLanguage: string
) {
  // Intenta enviar el PDF completo como "imagen" a Google Vision.
  // Vision acepta PDFs inline (hasta ~20MB) con DOCUMENT_TEXT_DETECTION.
  const result = await extractTextWithGoogleVisionImage(pdfBuffer, ocrLanguage);
  if (result.ok) {
    return { ...result, method: "google-vision-pdf" as const };
  }

  // Si falla (PDF demasiado grande o no soportado), intenta con pdftoppm si existe.
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "estimador-gvision-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    const prefix = path.join(tmpDir, "page");
    try {
      await fs.writeFile(pdfPath, pdfBuffer);
      await execFileAsync("pdftoppm", ["-jpeg", "-r", "140", "-f", "1", "-l", "8", pdfPath, prefix]);

      const names = (await fs.readdir(tmpDir))
        .filter((n) => /^page-\d+\.jpg$/i.test(n))
        .sort((a, b) => {
          const na = Number(a.match(/\d+/)?.[0] || 0);
          const nb = Number(b.match(/\d+/)?.[0] || 0);
          return na - nb;
        });

      if (names.length === 0) {
        return { ok: false as const, error: "No se pudieron generar páginas para Google Vision." };
      }

      const parts: string[] = [];
      for (const n of names) {
        const img = await fs.readFile(path.join(tmpDir, n));
        const out = await extractTextWithGoogleVisionImage(img, ocrLanguage);
        if (out.ok && out.text) parts.push(out.text);
      }

      const text = parts.join(" ").replace(/\s+/g, " ").trim();
      if (!text) {
        return { ok: false as const, error: "Google Vision por páginas no devolvió texto." };
      }
      return { ok: true as const, text, method: "google-vision-pages" as const };
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch {
    // pdftoppm no disponible (Vercel) — devolvemos el error original
    return { ok: false as const, error: result.error || "Google Vision no pudo procesar el PDF." };
  }
}

function unescapePdfString(input: string) {
  return input
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => {
      const code = parseInt(oct, 8);
      if (!Number.isFinite(code)) return "";
      return String.fromCharCode(code);
    });
}

function extractPdfTextFallback(buffer: Buffer) {
  const raw = buffer.toString("latin1");

  // Captura cadenas usadas en operaciones de texto de PDF (Tj / TJ).
  const tjMatches = Array.from(raw.matchAll(/\(([^()]*)\)\s*Tj/g));
  const tjText = tjMatches.map((m) => unescapePdfString(m[1]));

  const tjArrayMatches = Array.from(raw.matchAll(/\[(.*?)\]\s*TJ/gs));
  const tjArrayText = tjArrayMatches.flatMap((m) =>
    Array.from(m[1].matchAll(/\(([^()]*)\)/g)).map((x) => unescapePdfString(x[1]))
  );

  const combined = [...tjText, ...tjArrayText].join(" ").replace(/\s+/g, " ").trim();
  if (combined.length > 40) {
    return { text: combined, method: "pdf-text-operators" as const };
  }
  return { text: "", method: "pdf-text-operators" as const };
}

async function extractPdfText(buffer: Buffer) {
  try {
    // Carga dinámica: si pdf-parse no está disponible o falla, usamos fallback.
    const pdfParse = require("pdf-parse");
    if (typeof pdfParse === "function") {
      const parsed = await pdfParse(buffer);
      const text = String(parsed?.text || "").replace(/\s+/g, " ").trim();
      if (text.length > 40) {
        return { text, method: "pdf-parse" as const };
      }
    }
  } catch {
    // Seguimos con fallback silenciosamente.
  }

  // Fallback robusto para muchos PDFs de texto en macOS/Linux (si poppler está instalado).
  try {
    const tmpBase = path.join(os.tmpdir(), `estimador-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inPath = `${tmpBase}.pdf`;
    const outPath = `${tmpBase}.txt`;
    await fs.writeFile(inPath, buffer);

    try {
      await execFileAsync("pdftotext", ["-layout", inPath, outPath]);
      const text = (await fs.readFile(outPath, "utf8")).replace(/\s+/g, " ").trim();
      if (text.length > 40) {
        return { text, method: "pdftotext" as const };
      }
    } finally {
      await fs.unlink(inPath).catch(() => undefined);
      await fs.unlink(outPath).catch(() => undefined);
    }
  } catch {
    // Si pdftotext no está disponible, seguimos.
  }

  return extractPdfTextFallback(buffer);
}

async function extractDocxText(buffer: Buffer) {
  try {
    // Requiere dependencia opcional: mammoth
    const mammoth = require("mammoth");
    if (mammoth && typeof mammoth.extractRawText === "function") {
      const out = await mammoth.extractRawText({ buffer });
      const text = String(out?.value || "").replace(/\s+/g, " ").trim();
      if (text.length > 20) {
        return { ok: true as const, text, method: "docx-mammoth" as const };
      }
      return { ok: false as const, error: "No se ha podido extraer texto útil del DOCX." };
    }
  } catch {
    return {
      ok: false as const,
      error:
        "Falta soporte DOCX en el servidor. Instala mammoth (npm install mammoth) o sube un PDF con texto real.",
    };
  }

  return {
    ok: false as const,
    error:
      "Falta soporte DOCX en el servidor. Instala mammoth (npm install mammoth) o sube un PDF con texto real.",
  };
}

function extractTxtText(buffer: Buffer) {
  const text = buffer.toString("utf8").replace(/\s+/g, " ").trim();
  return { text, method: "txt-utf8" as const };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as (Blob & { name?: string; type?: string }) | null;
    const lang = String(formData.get("lang") || "fr");
    const urgency = String(formData.get("urgency") || "normal") as Urgency;

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ ok: false, error: "Adjunta un PDF para estimar." }, { status: 400 });
    }

    const fileType = String((file as any).type || "");
    const fileName = String((file as any).name || "archivo");
    const ocrLanguage = getOcrLanguage(lang);
    const ext = getFileExtension(fileName);

    const isPdf = fileType.includes("pdf") || ext === "pdf";
    const isDocx =
      fileType.includes("wordprocessingml.document") ||
      fileType.includes("msword") ||
      ext === "docx";
    const isTxt = fileType.startsWith("text/") || ext === "txt";
    const isImage = fileType.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext);

    if (!isPdf && !isDocx && !isTxt && !isImage) {
      return NextResponse.json(
        { ok: false, error: "Formato no soportado. Sube PDF, DOCX, TXT, JPG o PNG." },
        { status: 400 }
      );
    }

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    let extraction:
      | { text: string; method: "pdf-parse" | "pdftotext" | "pdf-text-operators" }
      | {
          text: string;
          method:
            | "docx-mammoth"
            | "txt-utf8"
            | "ocr-space"
            | "ocr-space-pages"
            | "google-vision"
            | "google-vision-pdf"
            | "google-vision-pages";
        };

    if (isPdf) {
      extraction = await extractPdfText(buffer);
    } else if (isDocx) {
      const docxExtraction = await extractDocxText(buffer);
      if (!docxExtraction.ok) {
        return NextResponse.json({ ok: false, error: docxExtraction.error }, { status: 422 });
      }
      extraction = { text: docxExtraction.text, method: docxExtraction.method };
    } else if (isImage) {
      const imageVision = await extractTextWithGoogleVisionImage(buffer, ocrLanguage);
      if (imageVision.ok) {
        extraction = imageVision;
      } else {
        const imageOcr = await extractTextWithOcrSpace(buffer, fileName, fileType, ocrLanguage);
        if (!imageOcr.ok) {
          return NextResponse.json(
            { ok: false, error: `No hemos podido extraer texto de la imagen. ${imageVision.error} | ${imageOcr.error}` },
            { status: 422 }
          );
        }
        extraction = imageOcr;
      }
    } else {
      extraction = extractTxtText(buffer);
    }

    let words = clampInt(countWords(extraction.text), 0, 200000);
    const unreliable = words < 5 || (isPdf && looksLikePdfTechnicalGarbage(extraction.text));

    let ocrError: string | null = null;
    if (isPdf && unreliable) {
      const visionExtraction = await extractPdfTextWithGoogleVision(buffer, ocrLanguage);
      if (visionExtraction.ok) {
        extraction = visionExtraction;
        words = clampInt(countWords(extraction.text), 0, 200000);
      } else {
        const ocrExtraction = await extractTextWithOcrSpace(buffer, fileName, fileType, ocrLanguage);
        if (ocrExtraction.ok) {
          extraction = ocrExtraction;
          words = clampInt(countWords(extraction.text), 0, 200000);
        } else {
          ocrError = `${visionExtraction.error} | ${ocrExtraction.error}`;

          // Si falla por tamaño del PDF, intenta OCR por páginas (OCR.space).
          if (/size exceeds|file failed validation/i.test(ocrExtraction.error || "")) {
            const pageOcr = await extractPdfTextWithOcrSpaceByPages(buffer, fileName, ocrLanguage);
            if (pageOcr.ok) {
              extraction = pageOcr;
              words = clampInt(countWords(extraction.text), 0, 200000);
              ocrError = null;
            } else {
              ocrError = `${ocrError} | ${pageOcr.error}`;
            }
          }
        }
      }
    }

    const normalizedText = normalizeOcrText(extraction.text);
    words = clampInt(countWords(normalizedText), 0, 200000);
    extraction = {
      ...extraction,
      text: normalizedText,
    };

    if (words < 5 || (isPdf && looksLikePdfTechnicalGarbage(extraction.text))) {
      return NextResponse.json(
        {
          ok: false,
          error:
            ocrError
              ? `No hemos podido extraer texto fiable. OCR: ${ocrError}`
              : "No hemos podido extraer texto fiable del archivo. Si es PDF escaneado, activa OCR automático (GOOGLE_VISION_API_KEY u OCR_SPACE_API_KEY) o usa presupuesto cerrado.",
        },
        { status: 422 }
      );
    }

    const rate = getWordRateForLangOrPair(lang);
    const base = Math.round(words * rate);
    const urgencyMultiplier = urgency === "urgente24" ? 1.25 : 1;
    const subtotal = Math.round(base * urgencyMultiplier);
    const total = Math.round(subtotal * SAFETY_MARGIN_MULTIPLIER);

    const ai = analyzeDocumentForBudget(extraction.text, words);

    return NextResponse.json({
      ok: true,
      words,
      rate,
      base,
      subtotal,
      total,
      marginPct: SAFETY_MARGIN_PCT,
      extractionMethod: extraction.method,
      ai,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno al estimar PDF." },
      { status: 500 }
    );
  }
}

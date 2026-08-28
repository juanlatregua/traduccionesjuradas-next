import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWordRateForLangOrPair } from "@/lib/pricing";
import { analyzeDocumentForBudget, normalizeOcrText } from "@/lib/ai-document";
import { assessAutoPriceRisk } from "@/lib/ai/price-risk";
import { isFrenchForeign, marginPctForCost } from "@/lib/quote-math";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);
const SAFETY_MARGIN_MULTIPLIER = 1.1;
const SAFETY_MARGIN_PCT = 10;
const WORDS_PER_FULL_PAGE = 240;
const WORDS_PER_HALF_PAGE = 120;

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

function estimatePdfPagesFromRaw(buffer: Buffer) {
  // Heuristica simple para PDFs cuando numpages no viene de pdf-parse.
  const raw = buffer.toString("latin1");
  const matches = raw.match(/\/Type\s*\/Page\b/g);
  return matches?.length || 0;
}

function estimateWordsByPages(numPages: number, currentWords: number) {
  if (numPages <= 0) return 0;

  if (currentWords <= 0) {
    return numPages === 1 ? WORDS_PER_HALF_PAGE : numPages * WORDS_PER_FULL_PAGE;
  }

  const minimumByHalfPage = numPages * WORDS_PER_HALF_PAGE;
  const equivalentFullPagesRead = currentWords / WORDS_PER_FULL_PAGE;
  const missingPages = Math.max(0, numPages - equivalentFullPagesRead);
  const withMissingPagesFilled = currentWords + missingPages * WORDS_PER_FULL_PAGE;

  return Math.round(Math.max(minimumByHalfPage, withMissingPagesFilled));
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

    // En Vercel no existe pdftoppm por defecto.
    if (process.env.VERCEL) {
      return {
        ok: false as const,
        error: "OCR por páginas no disponible en este entorno (pdftoppm no instalado).",
      };
    }

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
  let raw = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON || "";
  if (!raw) return null;

  // Quitar comillas simples externas si las hay (copiado de .env.local)
  if (raw.startsWith("'") && raw.endsWith("'")) {
    raw = raw.slice(1, -1);
  }

  try {
    const parsed = JSON.parse(raw) as GoogleServiceAccount;
    if (!parsed.client_email || !parsed.private_key) {
      console.error("[GOOGLE_VISION] JSON parseado pero faltan client_email o private_key.");
      return null;
    }
    return {
      ...parsed,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch (err) {
    console.error("[GOOGLE_VISION] Error parseando GOOGLE_VISION_SERVICE_ACCOUNT_JSON:", (err as Error)?.message);
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
      error: process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON
        ? "GOOGLE_VISION_SERVICE_ACCOUNT_JSON existe pero no se pudo parsear (revisa formato JSON en Vercel)."
        : "Falta configurar GOOGLE_VISION_SERVICE_ACCOUNT_JSON o GOOGLE_VISION_API_KEY.",
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

    const endpoint =
      accessToken || !apiKey
        ? "https://vision.googleapis.com/v1/images:annotate"
        : `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
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
      const errBody = await res.json().catch(() => null);
      const apiMsg = String(errBody?.error?.message || "");
      console.error("[GOOGLE_VISION]", res.status, apiMsg.slice(0, 200));
      const userMsg = apiMsg.includes("billing")
        ? "Google Vision requiere facturacion activa en el proyecto de Google Cloud."
        : `Google Vision HTTP ${res.status}`;
      return { ok: false as const, error: userMsg };
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
  const accessToken = await getGoogleAccessTokenFromServiceAccount();
  const apiKey = getGoogleVisionApiKey();
  if (!accessToken && !apiKey) {
    return {
      ok: false as const,
      error: process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON
        ? "GOOGLE_VISION_SERVICE_ACCOUNT_JSON existe pero no se pudo parsear (revisa formato JSON en Vercel)."
        : "Falta configurar GOOGLE_VISION_SERVICE_ACCOUNT_JSON o GOOGLE_VISION_API_KEY.",
    };
  }

  try {
    const endpoint =
      accessToken || !apiKey
        ? "https://vision.googleapis.com/v1/files:annotate"
        : `https://vision.googleapis.com/v1/files:annotate?key=${encodeURIComponent(apiKey)}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const pdfBase64 = pdfBuffer.toString("base64");
    const langHint = toVisionLanguageHint(ocrLanguage);

    // Google Vision files:annotate supports max 5 pages per request.
    // Process in batches of 5 pages up to 30 pages max.
    const MAX_PAGES = 30;
    const BATCH_SIZE = 5;
    const allChunks: string[] = [];

    for (let start = 1; start <= MAX_PAGES; start += BATCH_SIZE) {
      const pageNums = Array.from({ length: BATCH_SIZE }, (_, i) => start + i);

      const payload = {
        requests: [
          {
            inputConfig: {
              content: pdfBase64,
              mimeType: "application/pdf",
            },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            pages: pageNums,
            imageContext: {
              languageHints: [langHint],
            },
          },
        ],
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const apiMsg = String(errBody?.error?.message || "");
        console.error("[GOOGLE_VISION]", res.status, apiMsg.slice(0, 200));
        // If first batch fails, return error. If later batch fails, use what we have.
        if (allChunks.length === 0) {
          const userMsg = apiMsg.includes("billing")
            ? "Google Vision requiere facturacion activa en el proyecto de Google Cloud."
            : `Google Vision HTTP ${res.status}`;
          return { ok: false as const, error: userMsg };
        }
        break;
      }

      const data = (await res.json()) as any;
      const pages = data?.responses?.[0]?.responses;
      if (!Array.isArray(pages) || pages.length === 0) break;

      const batchText = pages
        .map((p: any) => String(p?.fullTextAnnotation?.text || ""))
        .filter(Boolean);
      if (batchText.length === 0) break; // No more pages with text

      allChunks.push(...batchText);

      // If we got fewer pages than requested, we've reached the end
      if (batchText.length < BATCH_SIZE) break;
    }

    const text = allChunks.join(" ").replace(/\s+/g, " ").trim();

    if (!text) {
      return { ok: false as const, error: "Google Vision files:annotate no devolvió texto." };
    }

    return { ok: true as const, text, method: "google-vision-pdf" as const };
  } catch {
    return { ok: false as const, error: "No se pudo conectar con Google Vision (files:annotate)." };
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
  let numPages = 0;

  try {
    // Carga dinámica: si pdf-parse no está disponible o falla, usamos fallback.
    const pdfParse = require("pdf-parse");
    if (typeof pdfParse === "function") {
      const parsed = await pdfParse(buffer);
      numPages = parsed?.numpages || 0;
      const text = String(parsed?.text || "").replace(/\s+/g, " ").trim();
      if (text.length > 40) {
        return { text, method: "pdf-parse" as const, numPages };
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
        return { text, method: "pdftotext" as const, numPages };
      }
    } finally {
      await fs.unlink(inPath).catch(() => undefined);
      await fs.unlink(outPath).catch(() => undefined);
    }
  } catch {
    // Si pdftotext no está disponible, seguimos.
  }

  if (!numPages) {
    numPages = estimatePdfPagesFromRaw(buffer);
  }

  return { ...extractPdfTextFallback(buffer), numPages };
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
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `estimador:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas estimaciones en poco tiempo. Intentalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

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
    let pdfNumPages = 0;
    let initialPdfVisionExtraction:
      | Awaited<ReturnType<typeof extractPdfTextWithGoogleVision>>
      | null = null;

    if (isPdf) {
      // Run local extraction and Google Vision in parallel for speed
      const [localExtraction, visionExtraction] = await Promise.all([
        extractPdfText(buffer),
        extractPdfTextWithGoogleVision(buffer, ocrLanguage),
      ]);
      initialPdfVisionExtraction = visionExtraction;

      const localWords = clampInt(countWords(localExtraction.text), 0, 200000);

      if (visionExtraction.ok) {
        const visionWords = clampInt(countWords(visionExtraction.text), 0, 200000);
        pdfNumPages = (localExtraction as any).numPages || 0;
        // Use whichever gives more words
        if (visionWords >= localWords) {
          extraction = {
            text: visionExtraction.text,
            method: visionExtraction.method,
            numPages: pdfNumPages,
          } as any;
        } else {
          extraction = localExtraction;
        }
        console.log(`[estimador] local: ${localWords} words (${localExtraction.method}), vision: ${visionWords} words → using ${visionWords >= localWords ? "vision" : "local"}`);
      } else {
        extraction = localExtraction;
        console.log(`[estimador] local: ${localWords} words (${localExtraction.method}), vision failed: ${visionExtraction.error}`);
      }
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
    const numPages = pdfNumPages || (extraction as any).numPages || 0;
    const wordsPerPage = numPages > 0 ? words / numPages : words;
    // Consider unreliable if: garbage text, very few words, OR suspiciously low word density per page
    // (< 150 words/page in a multi-page PDF likely means scanned/image content was missed)
    const unreliable = words < 5
      || (isPdf && looksLikePdfTechnicalGarbage(extraction.text))
      || (isPdf && numPages >= 2 && wordsPerPage < 150);

    let ocrError: string | null = null;
    if (isPdf && unreliable) {
      const visionExtraction =
        initialPdfVisionExtraction || (await extractPdfTextWithGoogleVision(buffer, ocrLanguage));
      if (visionExtraction.ok) {
        const visionWords = clampInt(countWords(visionExtraction.text), 0, 200000);
        // Use OCR result if it gives more words (more complete extraction)
        if (visionWords > words) {
          extraction = visionExtraction;
          words = visionWords;
        }
      } else {
        const ocrExtraction = await extractTextWithOcrSpace(buffer, fileName, fileType, ocrLanguage);
        if (ocrExtraction.ok) {
          const ocrWords = clampInt(countWords(ocrExtraction.text), 0, 200000);
          if (ocrWords > words) {
            extraction = ocrExtraction;
            words = ocrWords;
          }
        } else {
          ocrError = `${visionExtraction.error} | ${ocrExtraction.error}`;

          // Si falla por tamaño del PDF, intenta OCR por páginas (OCR.space).
          if (!process.env.VERCEL && /size exceeds|file failed validation/i.test(ocrExtraction.error || "")) {
            const pageOcr = await extractPdfTextWithOcrSpaceByPages(buffer, fileName, ocrLanguage);
            if (pageOcr.ok) {
              const pageWords = clampInt(countWords(pageOcr.text), 0, 200000);
              if (pageWords > words) {
                extraction = pageOcr;
                words = pageWords;
              }
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

    let estimatedByPages = false;
    if (isPdf && numPages > 0) {
      const wordsPerPageAfterOcr = words / Math.max(1, numPages);
      const needsPageEstimation =
        words < 5 ||
        looksLikePdfTechnicalGarbage(extraction.text) ||
        wordsPerPageAfterOcr < WORDS_PER_HALF_PAGE;

      if (needsPageEstimation) {
        const estimatedWords = estimateWordsByPages(numPages, words);
        if (estimatedWords > words) {
          words = estimatedWords;
          estimatedByPages = true;
          console.log(
            `[estimador] OCR incompleto: ajustado por paginas a ${words} palabras (${numPages} paginas; referencia ${WORDS_PER_HALF_PAGE}/${WORDS_PER_FULL_PAGE}).`
          );
        }
      }
    }

    if (words < 5) {
      return NextResponse.json(
        {
          ok: false,
          error:
            ocrError
              ? `No hemos podido extraer texto fiable. OCR: ${ocrError}`
              : "No hemos podido extraer texto fiable del archivo. Configura Google Vision (GOOGLE_VISION_SERVICE_ACCOUNT_JSON) u OCR_SPACE_API_KEY, o usa presupuesto cerrado.",
        },
        { status: 422 }
      );
    }

    const rate = getWordRateForLangOrPair(lang);
    const base = Math.round(words * rate);
    const urgencyMultiplier = urgency === "urgente24" ? 1.25 : 1;
    // subtotal = COSTE (sin IVA). Cliente paga coste × (1 + margen tiered) + IVA;
    // francés sin margen. Sustituye al antiguo colchón SAFETY_MARGIN del 10% y
    // alinea el estimador con la puerta (que ya cobra IVA). Ver lib/quote-math.ts.
    const subtotal = Math.round(base * urgencyMultiplier);
    const marginPct = isFrenchForeign(lang) ? 0 : marginPctForCost(subtotal);
    const withMargin = Math.round(subtotal * (1 + marginPct / 100));
    const total = Math.round(withMargin * (1 + 0.21));

    const ai = analyzeDocumentForBudget(extraction.text, words);

    // Red de seguridad anti-infracobro (incidente 1099-MISC): este carril legado
    // tarifica plano sin el gate de la puerta. Marcamos los documentos de riesgo
    // (fiscal/financiero, multi-copia, texto pegado) para que el frontend fuerce
    // revisión manual en vez de autopago. El gate DURO está en /api/orders.
    // El sintético lleva TAMBIÉN páginas y palabras: sin ellas, la red de
    // documento extenso (oversized_estimate) leía 0 y 0 y no disparaba nunca en
    // este carril, mientras que la puerta sí la aplicaba. Los datos ya estaban
    // aquí. Sin esto, un PDF de cientos de páginas seguía llegando a "Pagar y
    // confirmar pedido" por este camino — y el par francés no cae en revisión
    // interna por perfil de flujo, así que nada más lo frenaba.
    const priceRisk = assessAutoPriceRisk({
      analysis: {
        document_type: { category: "", specific_type: "" },
        document_metrics: {
          extracted_text: extraction.text,
          estimated_words: words,
          pages: numPages || 0,
        },
      } as any,
      extractedText: extraction.text,
    }).risky;

    return NextResponse.json({
      ok: true,
      words,
      rate,
      base,
      subtotal,
      total,
      estimatedByPages,
      pageCount: numPages || undefined,
      marginPct,
      extractionMethod: extraction.method,
      ai,
      priceRisk,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno al estimar PDF." },
      { status: 500 }
    );
  }
}

// app/api/documents/register/route.ts — Register uploaded blob as document

import { NextResponse } from "next/server";
import { isDeclaredPairValid, normalizeDeclaredLang } from "@/lib/puerta-languages";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export const runtime = "nodejs";

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit({
    key: `doc-register:${ip}`,
    limit: 15,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Has superado el límite diario de subidas." },
      { status: 429 }
    );
  }

  try {
    const { blobUrl, fileName, fileSize, mimeType, sessionToken, gdprConsent, source, clientEmail, marketingConsent, sourceLanguage, targetLanguage, gate } =
      await req.json();

    // Puerta (Juan, 4-sep-2026): NADA se sube sin email + par de idiomas. La UI
    // ya lo bloquea; aquí se exige también para que un lead no nazca a medias.
    const email = typeof clientEmail === "string" ? clientEmail.trim().toLowerCase() : "";
    const emailOk = !!email && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    const srcLang = normalizeDeclaredLang(sourceLanguage);
    const tgtLang = normalizeDeclaredLang(targetLanguage);
    if (gate === "puerta") {
      if (!emailOk) return NextResponse.json({ ok: false, error: "Indica tu email antes de subir el documento." }, { status: 400 });
      if (marketingConsent !== true) return NextResponse.json({ ok: false, error: "Falta el consentimiento para enviarte el presupuesto." }, { status: 400 });
      if (!isDeclaredPairValid(srcLang, tgtLang)) return NextResponse.json({ ok: false, error: "Indica el idioma del documento y el idioma al que lo necesitas." }, { status: 400 });
    } else if (clientEmail && !emailOk) {
      return NextResponse.json({ ok: false, error: "Email no válido." }, { status: 400 });
    }

    // Origen de captación (atribución del funnel). Whitelist para no guardar basura.
    // OJO: tiene que ir en paralelo con la de app/presupuesto-instantaneo/page.tsx:13,
    // que es quien traduce ?p=<preset> a este `source`. Estuvieron desincronizadas:
    // la página aceptaba "lavori" y aquí no estaba, así que TODA la atribución del
    // enlace de lavori se tiraba en silencio —sin error, sin log— y el carril
    // parecía no traer a nadie cuando en realidad no se estaba midiendo.
    const KNOWN_SOURCES = new Set(["regularizacion-2026", "uge-ce", "lector", "lavori", "precios"]);
    const normalizedSource =
      typeof source === "string" && KNOWN_SOURCES.has(source) ? source : null;

    if (!blobUrl || !fileName) {
      return NextResponse.json(
        { ok: false, error: "Datos de archivo requeridos." },
        { status: 400 }
      );
    }

    if (!gdprConsent) {
      return NextResponse.json(
        { ok: false, error: "Debes aceptar el tratamiento de datos para continuar." },
        { status: 400 }
      );
    }

    const token = sessionToken || crypto.randomUUID();

    const doc = await prisma.documentAnalysis.create({
      data: {
        fileName: String(fileName).slice(0, 255),
        fileUrl: blobUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/octet-stream",
        sessionToken: token,
        source: normalizedSource,
        ipHash: hashIp(ip),
        gdprConsent: true,
        gdprConsentAt: new Date(),
        status: "UPLOADED",
        ...(emailOk ? { clientEmail: email } : {}),
        ...(emailOk && marketingConsent === true ? { marketingConsent: true, marketingConsentAt: new Date() } : {}),
        // Par declarado: el análisis lo respeta (applyDeclaredLanguages).
        ...(srcLang && srcLang !== "other" ? { sourceLanguage: srcLang } : {}),
        ...(tgtLang ? { targetLanguage: tgtLang } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      fileUrl: blobUrl,
      sessionToken: token,
    });
  } catch (err: any) {
    console.error("[documents/register]", err);
    return NextResponse.json(
      { ok: false, error: "Error al registrar el documento." },
      { status: 500 }
    );
  }
}

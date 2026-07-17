// app/api/documents/contact/route.ts
// Engancha el email del cliente a los documentos de SU sesión, capturado
// mientras corre el análisis (el spinner es tiempo muerto en el que el usuario
// ya se ha comprometido subiendo el documento: ahí el email se da sin fricción,
// a diferencia de pedirlo en la entrada, que contradice el "presupuesto
// instantáneo en segundos" de la portada).
//
// marketingConsent va APARTE y no premarcado: el gdprConsent de la subida solo
// cubre tratar los DOCUMENTOS para generar el presupuesto. La LSSI (art. 21.1)
// exige autorización expresa y previa para el correo comercial.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit({
    key: `doc-contact:${ip}`,
    limit: 30,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });
  }

  try {
    const { sessionToken, clientEmail, marketingConsent } = await req.json();

    const token = typeof sessionToken === "string" ? sessionToken.trim() : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "Sesión no válida." }, { status: 400 });
    }

    // El límite se comprueba ANTES del regex: truncar después guardaría una
    // dirección distinta (y rota) como si fuese un lead bueno.
    // 254 = longitud máxima de una dirección de correo (RFC 5321).
    const email = typeof clientEmail === "string" ? clientEmail.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Email no válido." }, { status: 400 });
    }

    // Sin consentimiento no se guarda NADA: la única finalidad para la que se
    // pide este email es enviarle el presupuesto y su recordatorio. Guardarlo
    // "por si acaso" no tendría base legal.
    if (marketingConsent !== true) {
      return NextResponse.json(
        { ok: false, error: "Falta el consentimiento para enviarte el presupuesto." },
        { status: 400 }
      );
    }

    // Propiedad por sessionToken: solo se tocan los documentos de esta sesión.
    // Nunca se acepta un documentId suelto, o cualquiera podría estampar su
    // email sobre documentos ajenos.
    const res = await prisma.documentAnalysis.updateMany({
      where: { sessionToken: token },
      data: {
        clientEmail: email,
        marketingConsent: true,
        marketingConsentAt: new Date(),
      },
    });

    if (res.count === 0) {
      return NextResponse.json({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, updated: res.count });
  } catch (err: any) {
    console.error("[documents:contact] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el contacto." }, { status: 400 });
  }
}

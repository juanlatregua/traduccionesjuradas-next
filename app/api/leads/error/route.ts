// app/api/leads/error/route.ts — Capturar email de leads que fallan en el análisis IA

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit({
    key: `lead-error:${ip}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: true }); // Silently accept
  }

  try {
    const { email, documentId, error } = await req.json();

    if (!email || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // If we have a documentId, update the record with the email
    if (documentId) {
      await prisma.documentAnalysis.update({
        where: { id: documentId },
        data: {
          clientEmail: email.trim().toLowerCase(),
        },
      }).catch(() => {
        // Document might not exist, that's OK
      });
    }

    console.log(`[lead-error] email=${email} docId=${documentId} error=${error}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always return OK to the client
  }
}

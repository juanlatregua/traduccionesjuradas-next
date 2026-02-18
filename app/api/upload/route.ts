import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reference = formData.get("reference") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      return NextResponse.json({ ok: false, error: "Archivo demasiado grande (max 10 MB)." }, { status: 400 });
    }

    const prefix = reference ? `orders/${reference}` : "uploads";
    const pathname = `${prefix}/${Date.now()}-${file.name}`;

    const blob = await put(pathname, file, {
      access: "public",
    });

    return NextResponse.json({ ok: true, url: blob.url, pathname: blob.pathname });
  } catch (err: any) {
    console.error("[upload] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir archivo." },
      { status: 500 }
    );
  }
}

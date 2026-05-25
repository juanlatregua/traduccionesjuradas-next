import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import type { AuthState, SessionStep } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReference } from "@/lib/reference";
import { canAccess, routeForStep } from "@/lib/step";

export const TJ_SESSION_COOKIE = "tj_session";

type SessionWithDocs = Awaited<ReturnType<typeof getSessionById>>;

export function getSessionIdFromCookie() {
  return cookies().get(TJ_SESSION_COOKIE)?.value || null;
}

export function getSessionIdFromRequest(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TJ_SESSION_COOKIE}=`));
  if (!token) return null;
  return token.split("=").slice(1).join("=") || null;
}

export function attachSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set({
    name: TJ_SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSessionById(sessionId: string) {
  return prisma.orderSession.findUnique({
    where: { id: sessionId },
    include: {
      docs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function createSessionRecord(params?: {
  purpose?: string | null;
  step?: SessionStep;
  authState?: AuthState;
  userId?: string | null;
}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await prisma.orderSession.create({
        data: {
          reference: generateReference(),
          purpose: params?.purpose || null,
          step: params?.step || "UPLOAD",
          authState: params?.authState || "GUEST",
          userId: params?.userId || null,
        },
        include: {
          docs: true,
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
    }
  }
  throw new Error("No se pudo crear la sesion del encargo.");
}

export async function getSessionOrCreate(params?: {
  purpose?: string | null;
  step?: SessionStep;
  authState?: AuthState;
  userId?: string | null;
}) {
  const sessionId = getSessionIdFromCookie();
  if (sessionId) {
    const existing = await getSessionById(sessionId);
    if (existing) return existing;
  }
  return createSessionRecord(params);
}

export async function enforceStep(session: NonNullable<SessionWithDocs>, routeStep: SessionStep) {
  if (!canAccess(session.step, routeStep)) {
    redirect(routeForStep(session.step));
  }
  return session;
}

export async function getSessionOrRedirect(routeStep?: SessionStep) {
  const sessionId = getSessionIdFromCookie();
  if (!sessionId) {
    redirect("/presupuesto-instantaneo");
  }
  const session = await getSessionById(sessionId);
  if (!session) {
    redirect("/presupuesto-instantaneo");
  }
  if (routeStep) {
    await enforceStep(session, routeStep);
  }
  return session;
}


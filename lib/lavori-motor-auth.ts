// lib/lavori-motor-auth.ts — Bearer MOTOR_LAVORI_SECRET de las llamadas de lavori al motor.
import { timingSafeEqual } from "node:crypto";

export function hasMotorAuth(req: Request): boolean {
  const secret = process.env.MOTOR_LAVORI_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Refs de prueba del contrato del 3-oct: lavori las usa para probar en prod sin datos reales. */
export function isMotorTestRef(ref: string): boolean {
  return /^LEAD-PRUEBA-/.test(ref);
}

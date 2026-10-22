import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function hasCronSecret(req: Request, ...secrets: Array<string | undefined | null>) {
  const valid = secrets.filter((s): s is string => !!s);
  if (valid.length === 0) return false;
  const headers = [req.headers.get("x-cron-secret"), req.headers.get("authorization")];
  let ok = false;
  for (const secret of valid) {
    for (const header of headers) {
      if (!header) continue;
      if (safeEqual(header, secret)) ok = true;
      if (safeEqual(header, `Bearer ${secret}`)) ok = true;
    }
  }
  return ok;
}

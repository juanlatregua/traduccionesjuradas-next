// Solicitudes vivas a lavori que comparten el MISMO ARCHIVO (sha256), aunque el
// email, el teléfono o el caso sean distintos (LEAD-999C16C641 y LEAD-94DAFCF6F1,
// 19-nov-2026). Puro: el vigía le pasa las huellas ya resueltas.

export type SolHashes = { ref: string; status: string; par: string; createdAt: Date; docs: { hash: string; name: string }[] };
export type DupHashAlert = { a: string; b: string; name: string; hash: string };

const LIVE = new Set(["SENT", "PRICED"]);
const normPar = (p: string) => String(p || "").toLowerCase().replace(/[^a-z]+/g, ">");

/** Huella válida: 64 hex en minúsculas, o null. */
export function cleanSha256(x: unknown): string | null {
  const s = String(x ?? "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(s) ? s : null;
}

/** Un aviso por pareja (la más antigua primero). Mismo par: el mismo archivo a otro idioma no es duplicado. */
export function duplicateHashAlerts(sols: SolHashes[]): DupHashAlert[] {
  const live = sols.filter((s) => LIVE.has(s.status)).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime() || x.ref.localeCompare(y.ref));
  const out: DupHashAlert[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.ref === b.ref || normPar(a.par) !== normPar(b.par)) continue;
      const hit = a.docs.find((d) => d.hash && b.docs.some((e) => e.hash === d.hash));
      if (!hit) continue;
      const k = `${a.ref}|${b.ref}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ a: a.ref, b: b.ref, name: hit.name || "documento", hash: hit.hash });
    }
  }
  return out;
}

export const dupHashText = (d: DupHashAlert) => `⚠ ${d.a} y ${d.b} tienen el mismo archivo (${d.name}) → probable duplicado: retira una en lavori`;

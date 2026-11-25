export type Procedencia = { referrer: string; landing?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string };

const OWN_HOSTS = ["traduccionesjuradas.net"];
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

const cut = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
};

function hostOf(v: unknown): string {
  const raw = cut(v, 300);
  if (!raw) return "direct";
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return "direct";
  }
  host = host.toLowerCase().replace(/^www\./, "").slice(0, 100);
  if (!host || OWN_HOSTS.some((o) => host === o || host.endsWith(`.${o}`))) return "direct";
  return host;
}

export function sanearProcedencia(raw: unknown): Procedencia | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const landing = cut(r.landing, 200);
  const out: Procedencia = { referrer: hostOf(r.referrer), ...(landing?.startsWith("/") ? { landing } : {}) };
  for (const k of UTM_KEYS) {
    const v = cut(r[k], 60);
    if (v) out[k] = v;
  }
  return out;
}

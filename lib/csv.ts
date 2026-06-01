// lib/csv.ts — Primitivas de parseo CSV reutilizables (cliente y servidor).
// Extraídas de ImportInvoicesPanel para compartir con la conciliación bancaria.

export function norm(s: string): string {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function detectDelimiter(line: string): string {
  return (line.match(/;/g)?.length || 0) >= (line.match(/,/g)?.length || 0) ? ";" : ",";
}

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Importe español/estándar → céntimos. "1.234,56" → 123456; "-12.34" → -1234; "12,00 €" → 1200.
export function toCents(raw: string): number {
  let s = String(raw || "").replace(/[€\s]/g, "");
  if (!s) return 0;
  const neg = /^-/.test(s) || /-$/.test(s);
  s = s.replace(/-/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) * (neg ? -1 : 1);
}

// Mapea cabeceras a claves según un diccionario { clave: [nombres posibles normalizados] }.
export function mapColumns(headers: string[], dict: Record<string, string[]>): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(dict)) {
      if (idx[key] === undefined && names.includes(n)) idx[key] = i;
    }
  });
  return idx;
}

// Fecha flexible: ISO (yyyy-mm-dd), DD/MM/YYYY, DD-MM-YYYY, DD.MM.YY (banca española).
export function parseDateFlexible(s: string): Date | null {
  const t = String(s || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? null : dt;
}

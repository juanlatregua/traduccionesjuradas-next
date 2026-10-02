"use client";

import { useMemo, useState } from "react";
import { publicDict, type PublicDict, type PublicLang } from "@/lib/quote-public-i18n";

type DocLine = {
  id: string;
  description: string;
  sourceFileUrl?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
};

// El cliente entra por el token de su presupuesto (la URL del fichero sale de la
// BD); staff por extract-pages, que acepta la URL y exige sesión.
export function lineDocUrl(line: DocLine, opts: { token?: string; download?: boolean } = {}): string | null {
  if (!line.sourceFileUrl) return null;
  if (opts.token) {
    return `/api/q/${opts.token}/document?line=${encodeURIComponent(line.id)}${opts.download ? "&download=1" : ""}`;
  }
  const p = new URLSearchParams({ url: line.sourceFileUrl });
  if (line.pageStart) p.set("start", String(line.pageStart));
  if (line.pageEnd) p.set("end", String(line.pageEnd));
  p.set("name", line.description.slice(0, 60));
  if (opts.download) p.set("download", "1");
  return `/api/documents/extract-pages?${p.toString()}`;
}

// Chrome/Firefox no pintan HEIC/TIFF: en un iframe provocarían una descarga
// automática al abrir la página. Solo PDF e imágenes web se incrustan.
function previewKind(url: string): "pdf" | "img" | "other" {
  const ext = (url.split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
  return ext === "pdf" ? "pdf" : /^(jpe?g|png|webp|gif)$/.test(ext) ? "img" : "other";
}

function pagesLabel(line: DocLine, t: PublicDict) {
  if (!line.pageStart) return "";
  return line.pageEnd && line.pageEnd !== line.pageStart ? ` · ${t.docPages} ${line.pageStart}-${line.pageEnd}` : ` · ${t.docPage} ${line.pageStart}`;
}

export default function QuoteDocumentsViewer({
  lines,
  token,
  title = "Documentos",
  lang = "es",
}: {
  lines: DocLine[];
  token?: string;
  title?: string;
  lang?: PublicLang;
}) {
  const t = publicDict(lang);
  // Traducción y apostilla del mismo papel son dos líneas y un solo documento.
  const docs = useMemo(() => {
    const byKey = new Map<string, { line: DocLine; labels: string[] }>();
    for (const l of lines) {
      if (!l.sourceFileUrl) continue;
      const key = `${l.sourceFileUrl}|${l.pageStart ?? ""}|${l.pageEnd ?? ""}`;
      const group = byKey.get(key);
      if (group) group.labels.push(l.description);
      else byKey.set(key, { line: l, labels: [l.description] });
    }
    return Array.from(byKey.values());
  }, [lines]);
  const [selected, setSelected] = useState(0);

  if (docs.length === 0) return null;
  const current = docs[Math.min(selected, docs.length - 1)];
  const viewUrl = lineDocUrl(current.line, { token })!;
  const label = current.labels.join(" + ");
  const kind = previewKind(current.line.sourceFileUrl!);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-encre">
          {title} <span className="text-sm font-normal text-sepia">({docs.length})</span>
        </h2>
        <div className="flex gap-3 text-xs font-semibold">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-bleu hover:underline">
            {t.docOpenTab}
          </a>
          <a href={lineDocUrl(current.line, { token, download: true })!} className="text-bleu hover:underline">
            {t.docDownload}
          </a>
        </div>
      </div>

      {docs.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {docs.map((d, i) => (
            <button
              key={`${d.line.id}-${i}`}
              type="button"
              onClick={() => setSelected(i)}
              title={d.labels.join(" + ")}
              className={`max-w-[16rem] truncate rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                d === current ? "border-bleu bg-bleu text-white" : "border-slate-300 bg-white text-encre hover:border-bleu"
              }`}
            >
              {i + 1}. {d.labels[0]}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-sepia">
        {label}
        {pagesLabel(current.line, t)}
      </p>
      {kind === "pdf" ? (
        <>
          <iframe
            key={viewUrl}
            src={viewUrl}
            title={label}
            className="mt-2 h-[75vh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50"
          />
          <p className="mt-2 text-xs text-sepia sm:hidden">
            {t.docMobileHint}
          </p>
        </>
      ) : kind === "img" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={viewUrl}
          src={viewUrl}
          alt={label}
          className="mt-2 max-h-[75vh] max-w-full rounded-xl border border-slate-200 bg-slate-50"
        />
      ) : (
        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-sepia">
          {t.docNoPreview}
        </p>
      )}
    </div>
  );
}

// components/order-workspace/FileThumbnails.tsx
//
// Miniaturas de documentos (originales o traducciones) en la propia landing:
// imágenes como <img>, PDFs como vista previa <iframe> (1ª página). Cada una
// enlaza al fichero y lleva su botón de descarga. Server Component (sin JS).

import { blobDownloadUrl } from "@/lib/blob-download-url";

function isImage(s: string) {
  return /\.(jpe?g|png|webp|gif|heic|tiff?)(\?|#|$)/i.test(s);
}

export default function FileThumbnails({
  files,
}: {
  files: { name: string; url: string }[];
}) {
  if (!files.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {files.map((f, i) => {
        const img = isImage(f.url) || isImage(f.name);
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-sm transition hover:border-cyan-500">
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="group block">
              <div className="h-36 w-full overflow-hidden bg-slate-800/40">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                ) : (
                  <iframe
                    src={`${f.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title={f.name}
                    className="pointer-events-none h-full w-full"
                    loading="lazy"
                  />
                )}
              </div>
              <p
                className="truncate px-2 py-1.5 text-[11px] text-slate-300 group-hover:text-cyan-400"
                title={f.name}
              >
                {f.name}
              </p>
            </a>
            <a
              href={blobDownloadUrl(f.url)}
              download={f.name}
              className="block border-t border-slate-700 px-2 py-1.5 text-center text-xs font-semibold text-cyan-300 hover:bg-slate-800"
            >
              ⤓ Descargar
            </a>
          </div>
        );
      })}
    </div>
  );
}

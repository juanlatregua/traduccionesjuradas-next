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
          <div key={i} className="overflow-hidden rounded-xl border border-[#D5DAE1] bg-[#fff] shadow-sm transition hover:border-[#D5DAE1]">
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="group block">
              <div className="h-36 w-full overflow-hidden bg-[#F6F7F9]">
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
                className="truncate px-2 py-1.5 text-[11px] text-[#1F2933] group-hover:text-[#1A2E4A]"
                title={f.name}
              >
                {f.name}
              </p>
            </a>
            <a
              href={blobDownloadUrl(f.url)}
              download={f.name}
              className="block border-t border-[#D5DAE1] px-2 py-1.5 text-center text-xs font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9]"
            >
              ⤓ Descargar
            </a>
          </div>
        );
      })}
    </div>
  );
}

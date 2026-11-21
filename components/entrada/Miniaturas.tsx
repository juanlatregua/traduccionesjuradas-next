"use client";

// Miniaturas de las páginas que sube el cliente: las fotos tal cual; los PDF, página a página con pdf.js (se carga
// solo cuando hace falta la primera miniatura de un PDF). HEIC/TIFF: si el navegador no los pinta, un icono.
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, ImageOff, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type Hoja = { archivo: { id: string; name: string; url: string; mimeType: string }; page: number; label: string };

let lib: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjs() {
  if (!lib) {
    lib = (async () => {
      const P = Promise as unknown as { withResolvers?: unknown };
      if (!P.withResolvers) {
        P.withResolvers = function withResolvers<T>() {
          let resolve!: (v: T) => void;
          let reject!: (e: unknown) => void;
          const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
          return { promise, resolve, reject };
        };
      }
      const m = await import("pdfjs-dist");
      // webpack bundles the worker as its own module chunk (a plain asset URL would be minified as a script and break).
      m.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
      return m;
    })();
    lib.catch(() => { lib = null; });
  }
  return lib;
}

const docs = new Map<string, Promise<PDFDocumentProxy>>();
const renders = new Map<string, Promise<string>>();
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function pdfDoc(url: string) {
  let d = docs.get(url);
  if (!d) {
    d = pdfjs().then((m) => m.getDocument({ url, isEvalSupported: false }).promise);
    d.catch(() => docs.delete(url));
    docs.set(url, d);
  }
  return d;
}

/** One PDF page as a JPEG data URL, `width` CSS pixels wide (twice that for sharp screens). */
export function renderPdfPage(url: string, page: number, width: number): Promise<string> {
  const key = `${url}#${page}@${width}`;
  let r = renders.get(key);
  if (!r) {
    r = slot(async () => {
      const doc = await pdfDoc(url);
      const p = await doc.getPage(Math.min(page, doc.numPages));
      const scale = (width * Math.min(2, window.devicePixelRatio || 1)) / p.getViewport({ scale: 1 }).width;
      const viewport = p.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await p.render({ canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL("image/jpeg", 0.82);
    });
    r.catch(() => renders.delete(key));
    renders.set(key, r);
  }
  return r;
}

const isPdf = (m: string) => m === "application/pdf";

/** The page as an image source: the photo itself, or the PDF page rendered here. null while it renders; "" if it cannot. */
function usePageSrc(h: Hoja, width: number): string | null {
  const pdf = isPdf(h.archivo.mimeType);
  const [src, setSrc] = useState<string | null>(pdf ? null : h.archivo.url);
  useEffect(() => {
    if (!pdf) return setSrc(h.archivo.url);
    let alive = true;
    setSrc(null);
    renderPdfPage(h.archivo.url, h.page, width).then((s) => alive && setSrc(s), () => alive && setSrc(""));
    return () => { alive = false; };
  }, [pdf, h.archivo.url, h.page, width]);
  return src;
}

function Pagina({ h, width, className }: { h: Hoja; width: number; className: string }) {
  const src = usePageSrc(h, width);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (src === null) return <span className={`${className} animate-pulse bg-cream`} aria-hidden />;
  if (src === "" || broken) {
    const Icon = isPdf(h.archivo.mimeType) ? FileText : ImageOff;
    return (
      <span className={`${className} flex flex-col items-center justify-center gap-1 bg-parchment text-sepia`}>
        <Icon className="h-6 w-6" aria-hidden />
        <span className="max-w-full truncate px-1 text-[10px] uppercase">{h.archivo.name.split(".").pop()}</span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`${className} bg-white object-contain`} />;
}

/** A tappable page thumbnail with its caption. */
export function Miniatura({ h, onOpen, size = "md", highlight = false, ariaLabel }: { h: Hoja; onOpen?: () => void; size?: "sm" | "md"; highlight?: boolean; ariaLabel: string }) {
  const box = size === "sm" ? "h-14 w-10" : "h-[104px] w-[76px]";
  return (
    <figure className={`flex shrink-0 flex-col items-center gap-1 ${size === "sm" ? "w-10" : "w-[76px]"}`}>
      <button type="button" onClick={onOpen} disabled={!onOpen} aria-label={ariaLabel}
        className={`overflow-hidden rounded-md border bg-white shadow-sm transition ${highlight ? "border-or ring-2 ring-or" : "border-graphite/20"} [@media(hover:hover)]:hover:border-bleu`}>
        <Pagina h={h} width={size === "sm" ? 40 : 76} className={`block max-w-none ${box}`} />
      </button>
      {size === "md" && <figcaption className="max-w-[76px] truncate text-center text-[11px] text-graphite">{h.label}</figcaption>}
    </figure>
  );
}

/** Full-screen view of one page, with previous/next over the whole list. */
export function Visor({ hojas, index, onIndex, onClose, labels }: { hojas: Hoja[]; index: number; onIndex: (i: number) => void; onClose: () => void; labels: { cerrar: string; anterior: string; siguiente: string; deN: (i: number, n: number) => string } }) {
  const h = hojas[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = useCallback((d: number) => onIndex((index + d + hojas.length) % hojas.length), [index, hojas.length, onIndex]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);
  if (!h) return null;
  const width = typeof window === "undefined" ? 800 : Math.min(900, window.innerWidth - 32);
  return (
    <div role="dialog" aria-modal="true" aria-label={`${h.archivo.name} · ${h.label}`} className="fixed inset-0 z-[80] flex flex-col bg-encre/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 pb-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-semibold">{h.archivo.name} · {h.label}</p>
        <button ref={closeRef} type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/40 px-4 text-sm font-bold">
          <X className="h-4 w-4" aria-hidden />{labels.cerrar}
        </button>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Pagina key={`${h.archivo.id}:${h.page}`} h={h} width={width} className="max-h-full min-h-[240px] min-w-[170px] max-w-full rounded-lg shadow-2xl" />
      </div>
      {hojas.length > 1 && (
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 pt-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => go(-1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-parchment px-4 text-sm font-bold text-encre">
            <ChevronLeft className="h-4 w-4" aria-hidden />{labels.anterior}
          </button>
          <span className="text-sm text-white" aria-live="polite">{labels.deN(index + 1, hojas.length)}</span>
          <button type="button" onClick={() => go(1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-parchment px-4 text-sm font-bold text-encre">
            {labels.siguiente}<ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

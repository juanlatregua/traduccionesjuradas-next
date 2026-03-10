"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DraftGeneratorButton from "./DraftGeneratorButton";
import SourceDocumentUpload from "./SourceDocumentUpload";

type TranslationSection = {
  tipo: string;
  titulo_seccion: string | null;
  contenido: string;
};

type TranslationResult = {
  tipo_documento: string;
  direccion: "ES→FR" | "FR→ES";
  tribunal_organismo: string | null;
  referencia_original: string | null;
  fecha_documento: string | null;
  codigo_verificacion: string | null;
  url_verificacion?: string | null;
  firmantes: string[];
  secciones: TranslationSection[];
  notas_revisor: string[];
  notas_traductor?: string;
};

type SectionState = {
  original: string;
  editado: string;
  revisada: boolean;
};

type SourceDoc = {
  name: string;
  url?: string;
  type?: string;
};

type CollaboratorDelivery = {
  fileUrl: string;
  filename: string;
  deliveredAt: string | null;
  collaboratorName: string;
};

type Props = {
  reference: string;
  langPair: string | null;
  draftContentJson: string | null;
  draftFileUrl: string | null;
  draftFilename: string | null;
  draftGeneratedAt: string | null;
  documents: SourceDoc[];
  collaboratorDelivery?: CollaboratorDelivery | null;
};

function getFileType(filename: string): "pdf" | "docx" | "image" | "unknown" {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "docx";
  if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) return "image";
  return "unknown";
}

function calcRows(text: string): number {
  const lines = text.split("\n").length;
  const charLines = Math.ceil(text.length / 80);
  return Math.max(3, Math.min(30, Math.max(lines, charLines) + 1));
}

function matchNoteToSection(nota: string, secciones: TranslationSection[]): number {
  const words = nota.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  for (let i = 0; i < secciones.length; i++) {
    const contenido = secciones[i].contenido.toLowerCase();
    if (words.some((w) => contenido.includes(w))) return i;
  }
  return 0;
}

export default function WorkspaceEditor({
  reference,
  langPair,
  draftContentJson,
  draftFileUrl,
  draftFilename,
  draftGeneratedAt,
  documents,
  collaboratorDelivery,
}: Props) {
  const router = useRouter();
  const [parsed, setParsed] = useState<TranslationResult | null>(() => {
    if (!draftContentJson) return null;
    try {
      return JSON.parse(draftContentJson) as TranslationResult;
    } catch {
      return null;
    }
  });

  const [secciones, setSecciones] = useState<SectionState[]>(() => {
    if (!parsed) return [];
    return parsed.secciones.map((s) => ({
      original: s.contenido,
      editado: s.contenido,
      revisada: false,
    }));
  });

  const [notasTraductor, setNotasTraductor] = useState(() => parsed?.notas_traductor || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [downloading, setDownloading] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const notasTimer = useRef<NodeJS.Timeout | null>(null);
  const hasPendingChanges = secciones.some((s) => s.editado !== s.original);

  // Cleanup timers on unmount + flush pending save
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (notasTimer.current) clearTimeout(notasTimer.current);
    };
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingChanges, saveStatus]);

  // Assign reviewer notes to sections
  const notesBySection = useRef<Map<number, string[]>>(new Map());
  useEffect(() => {
    if (!parsed) return;
    const map = new Map<number, string[]>();
    for (const nota of parsed.notas_revisor || []) {
      const idx = matchNoteToSection(nota, parsed.secciones);
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(nota);
    }
    notesBySection.current = map;
  }, [parsed]);

  const doSave = useCallback(async (sections: SectionState[], notes?: string) => {
    if (!parsed) return;
    setSaveStatus("saving");
    try {
      const updated: TranslationResult = {
        ...parsed,
        secciones: parsed.secciones.map((s, i) => ({
          ...s,
          contenido: sections[i]?.editado ?? s.contenido,
        })),
        notas_traductor: notes ?? notasTraductor,
      };
      const res = await fetch(`/api/orders/${reference}/draft-content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftContentJson: JSON.stringify(updated) }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        console.error("[WorkspaceEditor] autosave failed", res.status);
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("[WorkspaceEditor] autosave error", err);
      setSaveStatus("error");
    }
  }, [parsed, reference, notasTraductor]);

  function updateSection(index: number, text: string) {
    setSecciones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], editado: text };
      // Debounce autosave
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => doSave(next), 3000);
      return next;
    });
    setSaveStatus("idle");
  }

  function updateNotasTraductor(text: string) {
    setNotasTraductor(text);
    setSaveStatus("idle");
    if (notasTimer.current) clearTimeout(notasTimer.current);
    notasTimer.current = setTimeout(() => doSave(secciones, text), 3000);
  }

  function toggleRevisada(index: number) {
    setSecciones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], revisada: !next[index].revisada };
      return next;
    });
  }

  const allRevisadas = secciones.length > 0 && secciones.every((s) => s.revisada);
  const revisadasCount = secciones.filter((s) => s.revisada).length;

  function handleRegenerate() {
    if (!window.confirm("¿Regenerar el borrador IA? Se perderán las ediciones actuales.")) return;
    setParsed(null);
    setSecciones([]);
    setNotasTraductor("");
    setSaveStatus("idle");
  }

  async function handleDownload() {
    if (!parsed || !Array.isArray(parsed.secciones) || parsed.secciones.length === 0) return;
    setDownloading(true);
    try {
      const updated: TranslationResult = {
        ...parsed,
        secciones: parsed.secciones.map((s, i) => ({
          ...s,
          contenido: secciones[i]?.editado ?? s.contenido,
        })),
        notas_traductor: notasTraductor || undefined,
      };
      const res = await fetch("/api/traduccion-automatica/download-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: updated,
          orderReference: reference,
          direccion: parsed.direccion || "ES→FR",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as any)?.error || "Error al generar DOCX.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BORRADOR_${reference}_JUR.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error de red al descargar DOCX.");
    } finally {
      setDownloading(false);
    }
  }

  // Detect first document for viewer (collaborator delivery takes priority)
  const collabFileType = collaboratorDelivery ? getFileType(collaboratorDelivery.filename) : null;
  const firstDoc = documents.find((d) => d.url);
  const docUrl = collaboratorDelivery?.fileUrl || firstDoc?.url || null;
  const docType = firstDoc?.type || firstDoc?.name?.toLowerCase() || "";
  const isImage = collaboratorDelivery
    ? collabFileType === "image"
    : /\.(jpg|jpeg|png|webp|gif)$/i.test(docType) || docType.startsWith("image/");
  const isPdf = collaboratorDelivery ? collabFileType === "pdf" : true; // default iframe for non-collab
  const isDocx = collaboratorDelivery ? collabFileType === "docx" : false;

  // If no draft content, show the generator
  if (!parsed) {
    return (
      <div className="space-y-6">
        {/* Document viewer + upload */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Documentos fuente</p>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No hay documentos fuente.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {documents.map((doc, idx) => (
                <li key={`${doc.name}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <span className="text-sm text-slate-200">{doc.name}</span>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-cyan-500/40 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10">Descargar</a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <SourceDocumentUpload reference={reference} />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-300">Borrador IA</p>
          <DraftGeneratorButton
            orderReference={reference}
            documents={documents}
            langPair={langPair}
            existingDraftUrl={draftFileUrl}
            existingDraftFilename={draftFilename}
            existingDraftGeneratedAt={draftGeneratedAt}
          />
          {draftFileUrl && !draftContentJson && (
            <p className="mt-3 text-xs text-amber-300">
              El borrador fue generado antes de la actualización del workspace. Regenera para habilitar la edición en dos columnas.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">
            {revisadasCount}/{secciones.length} secciones revisadas
          </span>
          {hasPendingChanges && saveStatus === "idle" && (
            <span className="text-xs text-amber-400">Cambios sin guardar</span>
          )}
          {saveStatus === "saving" && <span className="text-xs text-cyan-400">Guardando...</span>}
          {saveStatus === "saved" && <span className="text-xs text-emerald-400">Guardado</span>}
          {saveStatus === "error" && <span className="text-xs text-red-400">Error al guardar</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
          >
            Regenerar IA
          </button>
          <button
            type="button"
            onClick={() => doSave(secciones)}
            disabled={saveStatus === "saving"}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700/50 disabled:opacity-50"
          >
            Guardar ahora
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            {downloading ? "Generando..." : "Descargar DOCX"}
          </button>
        </div>
      </div>

      {allRevisadas && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Todas las secciones revisadas. Lista para entregar.
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left column: collaborator delivery (priority) or original document */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            {collaboratorDelivery ? "Entrega colaborador" : "Original"}
          </p>

          {collaboratorDelivery && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              Entrega de {collaboratorDelivery.collaboratorName}
              {collaboratorDelivery.deliveredAt && (
                <span className="ml-2 text-emerald-400/60">
                  {new Date(collaboratorDelivery.deliveredAt).toLocaleDateString("es-ES")}
                </span>
              )}
              <a
                href={collaboratorDelivery.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 font-semibold underline"
              >
                Descargar
              </a>
            </div>
          )}

          {docUrl ? (
            isDocx ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-8 text-center">
                <p className="text-sm text-slate-300">Archivo Word: <strong>{collaboratorDelivery?.filename}</strong></p>
                <p className="mt-2 text-xs text-slate-400">Los archivos Word no se pueden previsualizar. Descarga para revisar.</p>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
                >
                  Descargar DOCX
                </a>
              </div>
            ) : isImage ? (
              <img
                src={docUrl}
                alt={collaboratorDelivery ? "Entrega colaborador" : "Documento original"}
                className="w-full rounded-xl border border-slate-700"
              />
            ) : (
              <iframe
                src={docUrl}
                className="w-full rounded-xl border border-slate-700"
                style={{ minHeight: "800px", height: "calc(100vh - 280px)" }}
                title={collaboratorDelivery ? "Entrega colaborador" : "Documento original"}
              />
            )
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-8 text-center">
              <p className="text-sm text-slate-400">No hay documento fuente adjunto.</p>
              <div className="mt-4">
                <SourceDocumentUpload reference={reference} />
              </div>
            </div>
          )}

          {/* Source documents list (always shown when collaborator delivery is displayed) */}
          {collaboratorDelivery && documents.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Documentos originales</p>
              {documents.map((doc, idx) => (
                <div key={`${doc.name}-${idx}`} className="flex items-center justify-between text-xs text-slate-400">
                  <span>{doc.name}</span>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Abrir</a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Document list below viewer (when no collaborator delivery) */}
          {!collaboratorDelivery && documents.length > 1 && (
            <div className="space-y-1">
              {documents.map((doc, idx) => (
                <div key={`${doc.name}-${idx}`} className="flex items-center justify-between text-xs text-slate-400">
                  <span>{doc.name}</span>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Abrir</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: editable translation */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Traducción</p>

          {/* Document metadata */}
          {(parsed.tribunal_organismo || parsed.referencia_original) && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-xs text-slate-400">
              {parsed.tribunal_organismo && <p>Tribunal/Organismo: <span className="text-slate-200">{parsed.tribunal_organismo}</span></p>}
              {parsed.referencia_original && <p>Ref. original: <span className="text-slate-200">{parsed.referencia_original}</span></p>}
              {parsed.fecha_documento && <p>Fecha documento: <span className="text-slate-200">{parsed.fecha_documento}</span></p>}
              <p>Dirección: <span className="text-slate-200">{parsed.direccion}</span></p>
            </div>
          )}

          {/* Sections */}
          {secciones.map((seccion, idx) => {
            const meta = parsed.secciones[idx];
            const notes = notesBySection.current.get(idx) || [];
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 transition-colors ${
                  seccion.revisada
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-slate-700 bg-slate-900/80"
                }`}
              >
                {/* Section header */}
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seccion.revisada}
                      onChange={() => toggleRevisada(idx)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30"
                    />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-300">
                      {meta?.titulo_seccion || meta?.tipo || `Sección ${idx + 1}`}
                    </span>
                  </label>
                  {seccion.revisada && (
                    <span className="text-[10px] font-semibold text-emerald-400">Revisada</span>
                  )}
                </div>

                {/* Inline reviewer notes */}
                {notes.map((nota, nIdx) => (
                  <div
                    key={nIdx}
                    className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300"
                  >
                    {nota}
                  </div>
                ))}

                {/* Editable text */}
                <textarea
                  value={seccion.editado}
                  onChange={(e) => updateSection(idx, e.target.value)}
                  rows={calcRows(seccion.editado)}
                  className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-200 focus:outline-none focus:ring-0"
                />
              </div>
            );
          })}

          {/* Translator notes */}
          <div className="mt-6">
            <p className="mb-2 text-xs uppercase text-slate-500">Notas del traductor</p>
            <textarea
              value={notasTraductor}
              onChange={(e) => updateNotasTraductor(e.target.value)}
              placeholder="Observaciones, términos dudosos, aclaraciones para el cliente..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300 resize-none focus:border-slate-600 focus:outline-none focus:ring-0"
              rows={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

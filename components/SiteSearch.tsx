"use client";

// components/SiteSearch.tsx — Buscador del sitio (lupa + ⌘K).
// Modal tipo command-palette: teclea y salta a cualquier página del sitio.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { searchSite, groupResults, type SearchEntry } from "@/lib/search/match";

const MAX_RESULTS = 18;

export default function SiteSearch({ index }: { index: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => searchSite(query, index, MAX_RESULTS),
    [query, index]
  );
  const grouped = useMemo(() => groupResults(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    triggerRef.current?.focus();
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      setActive(0);
      router.push(path);
    },
    [router]
  );

  // Abrir con ⌘K / Ctrl+K desde cualquier sitio
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Al abrir: foco al input + bloquear scroll del body
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Mantener visible el resultado activo
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#search-opt-${active}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[active];
      if (target) go(target.path);
      else if (query.trim()) go(`/buscar?q=${encodeURIComponent(query.trim())}`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  // Índice plano para mapear grupo→índice global del resultado activo
  let flatIndex = -1;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar en la web"
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-cream bg-card px-2.5 text-sepia shadow-sm transition-colors hover:border-bleu sm:px-3"
      >
        <Search className="h-4 w-4 text-bleu" aria-hidden="true" />
        <span className="hidden text-sm text-graphite sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-cream bg-parchment px-1.5 py-0.5 text-[10px] font-semibold text-graphite lg:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-encre/40 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar en la web"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-cream bg-card shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-cream px-4">
              <Search className="h-5 w-5 shrink-0 text-bleu" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="search-results"
                aria-activedescendant={
                  results.length > 0 ? `search-opt-${active}` : undefined
                }
                aria-label="Buscar páginas, idiomas, ciudades o documentos"
                placeholder="Busca idioma, ciudad, documento, guía…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKeyDown}
                className="w-full bg-transparent py-4 text-base text-encre outline-none placeholder:text-graphite"
              />
              <kbd className="hidden shrink-0 rounded border border-cream bg-parchment px-1.5 py-0.5 text-[10px] font-semibold text-graphite sm:inline">
                Esc
              </kbd>
            </div>

            {/* Resultados */}
            <div
              ref={listRef}
              id="search-results"
              role="listbox"
              aria-label="Resultados de búsqueda"
              className="max-h-[55vh] overflow-y-auto p-2"
            >
              {query.trim() === "" && (
                <p className="px-3 py-6 text-center text-sm text-graphite">
                  Escribe para buscar en toda la web: idiomas, ciudades,
                  documentos, precios, guías…
                </p>
              )}

              {query.trim() !== "" && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-graphite">
                  Sin resultados para «{query}». Prueba con otra palabra o{" "}
                  <a
                    href="https://wa.me/34951333614"
                    className="font-semibold text-bleu hover:underline"
                  >
                    escríbenos por WhatsApp
                  </a>
                  .
                </p>
              )}

              {grouped.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-graphite">
                    {group}
                  </p>
                  {items.map((item) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const isActive = idx === active;
                    return (
                      <button
                        key={item.path}
                        id={`search-opt-${idx}`}
                        role="option"
                        aria-selected={isActive}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(item.path)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive ? "bg-bleu/10 text-bleu" : "text-encre hover:bg-cream"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {isActive && (
                          <CornerDownLeft
                            className="h-3.5 w-3.5 shrink-0 text-bleu"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {query.trim() !== "" && results.length > 0 && (
                <button
                  type="button"
                  onClick={() => go(`/buscar?q=${encodeURIComponent(query.trim())}`)}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-center text-xs font-medium text-bleu hover:bg-cream"
                >
                  Ver todos los resultados para «{query.trim()}»
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

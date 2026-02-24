"use client";

import { useState } from "react";

type CopyFieldProps = {
  label: string;
  value: string;
  copyValue?: string;
  mono?: boolean;
  actionLabel?: string;
  actionHref?: string;
  onCopied?: (label: string) => void;
};

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return;
  }

  throw new Error("No se pudo copiar.");
}

export default function CopyField({
  label,
  value,
  copyValue,
  mono = true,
  actionLabel,
  actionHref,
  onCopied,
}: CopyFieldProps) {
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    setError(null);
    setCopying(true);
    try {
      await copyText(copyValue || value);
      onCopied?.(label);
    } catch {
      setError("No se pudo copiar.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className={`min-w-0 flex-1 break-all text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</p>
        {actionHref && actionLabel && (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {actionLabel}
          </a>
        )}
        <button
          type="button"
          onClick={handleCopy}
          disabled={copying}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          aria-label={`Copiar ${label}`}
        >
          {copying ? "Copiando..." : "Copiar"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}


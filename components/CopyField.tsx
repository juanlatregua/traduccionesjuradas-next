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
  copyLabel?: string;
  copyingLabel?: string;
  errorLabel?: string;
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
  copyLabel = "Copiar",
  copyingLabel = "Copiando...",
  errorLabel = "No se pudo copiar.",
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
      setError(errorLabel);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="rounded-xl border border-cream bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className={`min-w-0 flex-1 break-all text-sm text-encre ${mono ? "font-mono" : ""}`}>{value}</p>
        {actionHref && actionLabel && (
          <a
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-cream px-3 text-sm font-semibold text-sepia hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu"
          >
            {actionLabel}
          </a>
        )}
        <button
          type="button"
          onClick={handleCopy}
          disabled={copying}
          className="min-h-[44px] rounded-lg border border-cream px-3 text-sm font-semibold text-sepia hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bleu disabled:opacity-60"
          aria-label={`${copyLabel} ${label}`}
        >
          {copying ? copyingLabel : copyLabel}
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}


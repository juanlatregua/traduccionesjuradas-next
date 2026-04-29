// Server-rendered placeholder for PresupuestoInstantaneoClient.
// Reserves the same vertical space and renders identical-looking upload UI so
// the LCP element exists in the initial HTML (kills CLS, slashes LCP on mobile).
// Hydration replaces this with the real interactive widget without layout shift.

export default function UploadHeroPlaceholder() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-hidden="true"
    >
      <label className="flex items-start gap-3 select-none">
        <span className="mt-1 inline-block h-4 w-4 rounded border border-graphite/40 bg-white" />
        <span className="text-sm text-sepia">
          He leído y acepto el{" "}
          <span className="text-bleu underline underline-offset-2">
            tratamiento de mis datos
          </span>{" "}
          conforme al RGPD.
        </span>
      </label>

      <div className="relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-bleu/30 bg-card px-6 py-12 text-center min-h-[280px]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bleu/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-bleu"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div>
          <p className="text-base font-semibold text-encre">
            Arrastra tu documento aquí
          </p>
          <p className="mt-1 text-sm text-sepia">
            PDF o foto · hasta 20 MB · análisis en segundos
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-lg border border-bleu/20 bg-white px-4 py-2 text-sm font-medium text-bleu shadow-sm">
            Seleccionar archivo
          </span>
          <span className="rounded-lg border border-bleu/20 bg-white px-4 py-2 text-sm font-medium text-bleu shadow-sm sm:hidden">
            Tomar foto
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-graphite">
        ¿No sabes cómo escanear bien?{" "}
        <span className="text-bleu underline underline-offset-2">
          Ver guía de 2 minutos
        </span>
      </p>
    </div>
  );
}

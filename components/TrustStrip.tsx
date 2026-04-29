export function TrustStrip() {
  return (
    <div className="bg-bleu text-cream/90 text-xs sm:text-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center sm:gap-4">
        <span className="hidden sm:inline">Traductor jurado N.º 3850</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <span>MAEC</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          4,8 <span className="text-or" aria-hidden="true">★</span> 46 reseñas Google
        </span>
        <span aria-hidden="true">·</span>
        <span>Entrega 24-72 h</span>
      </div>
    </div>
  );
}

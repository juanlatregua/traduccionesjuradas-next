"use client";

type Props = {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting?: boolean;
};

export default function BulkDeleteBar({ selectedCount, onDelete, onClear, isDeleting }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#F0C9C9] bg-white px-5 py-3 shadow-2xl backdrop-blur-sm">
      <span className="text-sm font-semibold text-[#1F2933]">
        {selectedCount} pedido{selectedCount > 1 ? "s" : ""} seleccionado{selectedCount > 1 ? "s" : ""}
      </span>
      <button
        type="button"
        disabled={isDeleting}
        onClick={onDelete}
        className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
      >
        {isDeleting ? "Eliminando..." : "Eliminar"}
      </button>
      <button
        type="button"
        disabled={isDeleting}
        onClick={onClear}
        className="rounded-lg border border-[#D5DAE1] px-4 py-2 text-xs font-semibold text-[#1F2933] hover:bg-[#F6F7F9] disabled:opacity-50"
      >
        Deseleccionar
      </button>
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

export type ItemCarrito = {
  id: string;
  tipo: string;
  tipoLabel: string;
  combinacion: string;
  palabras: number;
  precioEstimado: number;
  archivoNombre?: string;
  sinPrecio?: boolean;
  precioFijo?: boolean;
};

const STORAGE_KEY = "tj-carrito-presupuesto";

export function useCarritoPresupuesto() {
  const [items, setItems] = useState<ItemCarrito[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const añadir = useCallback((item: Omit<ItemCarrito, "id">) => {
    setItems((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
  }, []);

  const eliminar = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const vaciar = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.precioEstimado, 0),
    [items]
  );

  return { items, añadir, eliminar, vaciar, total };
}

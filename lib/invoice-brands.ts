// lib/invoice-brands.ts — Perfiles de emisor por marca/actividad.
// Misma sociedad (HBTJ Consultores Lingüísticos S.L., CIF B93712784) y mismo
// IBAN; cambia el logo, la dirección y la identidad comercial. La numeración
// fiscal AA_NNN es ÚNICA y compartida entre todas las marcas.
// Cuenta de cobro = Sabadell (Juan, 11-sep-2026: BBVA en cierre), la misma fuente
// que los presupuestos (lib/payment-labels.ts).

import { PAYMENT_ACCOUNTS, type PaymentAccount } from "@/lib/payment-labels";

const COBRO = PAYMENT_ACCOUNTS.sabadell as Extract<PaymentAccount, { kind: "transfer" }>;

export type BrandKey = "traduccionesjuradas" | "holabonjour" | "dev";

export type BrandProfile = {
  key: BrandKey;
  label: string; // nombre comercial mostrado en la UI
  emitterName: string;
  cif: string;
  address: string;
  city: string;
  bic: string;
  iban: string;
  // logo: "vector" usa el dibujo vectorial TJ; "image" carga public/<logoPath>.
  logo: { kind: "vector" } | { kind: "image"; path: string; widthMm: number; heightMm: number };
};

export const BRANDS: Record<BrandKey, BrandProfile> = {
  traduccionesjuradas: {
    key: "traduccionesjuradas",
    label: "Traducciones Juradas",
    emitterName: "HBTJ Consultores Lingüísticos S.L",
    cif: "B93712784",
    address: "Calle Esperanto, 9",
    city: "29007 Málaga · España",
    bic: COBRO.bic,
    iban: COBRO.iban,
    logo: { kind: "vector" },
  },
  holabonjour: {
    key: "holabonjour",
    label: "Hola Bonjour (academia)",
    emitterName: "HBTJ Consultores Lingüísticos S.L",
    cif: "B93712784",
    address: "C/ Barroso, 10 1ºIzq",
    city: "29001 Málaga",
    bic: COBRO.bic,
    iban: COBRO.iban,
    // Logo extraído de la plantilla original de facturas (burbuja "Hola Bonjour"
    // + señas SOHO). 532×650 px → mantener proporción 0,82 para no deformarlo.
    // Tamaño del modelo de Juan (26_054, 11-sep-2026): ~35×40 mm; a 26×32 salía
    // pequeño y las señas SOHO no se leían.
    logo: { kind: "image", path: "public/brands/holabonjour.png", widthMm: 31.1, heightMm: 38 },
  },
  // Tercera actividad: desarrollo web y backoffice para terceros (p.ej. la puesta
  // a punto de bechtraducciones.com). Mismo NIF, mismo IBAN y MISMA numeración
  // correlativa AA_NNN que el resto: es un apartado comercial, no una serie
  // fiscal aparte (decisión D2 — un solo contador maestro en BD).
  dev: {
    key: "dev",
    label: "HBTJ Dev (web y backoffice)",
    emitterName: "HBTJ Consultores Lingüísticos S.L",
    cif: "B93712784",
    address: "Calle Esperanto, 9",
    city: "29007 Málaga · España",
    bic: COBRO.bic,
    iban: COBRO.iban,
    logo: { kind: "vector" },
  },
};

export function getBrand(key?: string | null): BrandProfile {
  return BRANDS[(key as BrandKey) in BRANDS ? (key as BrandKey) : "traduccionesjuradas"];
}

export const BRAND_OPTIONS = Object.values(BRANDS).map((b) => ({ value: b.key, label: b.label }));

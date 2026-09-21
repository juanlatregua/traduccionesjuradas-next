// lib/shipping-validation.ts — Datos de envío en papel. Puro: lo usan el
// formulario (cliente) y el endpoint firmado (servidor) con las mismas reglas.

export type ShippingInput = {
  name: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
};

export type ShippingField = keyof ShippingInput;

export type ShippingValidation =
  | { ok: true; data: ShippingInput }
  | { ok: false; errors: Partial<Record<ShippingField, string>> };

const clean = (v: unknown, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function isSpain(country: string): boolean {
  return /^(españa|espana|spain|es)$/i.test(country.trim());
}

/** Teléfono razonable: +34…, 0034…, o 9 cifras españolas; internacional de 8 a 15 cifras. */
export function normalizeShippingPhone(raw: string): string | null {
  let p = String(raw || "").replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (/^[6789]\d{8}$/.test(p)) return `+34${p}`;
  if (/^\+[1-9]\d{7,14}$/.test(p)) return p;
  return null;
}

export function validateShippingInput(raw: Partial<Record<ShippingField, unknown>>): ShippingValidation {
  const data: ShippingInput = {
    name: clean(raw.name),
    phone: clean(raw.phone, 40),
    address: clean(raw.address, 300),
    postalCode: clean(raw.postalCode, 12).toUpperCase(),
    city: clean(raw.city),
    province: clean(raw.province),
    country: clean(raw.country) || "España",
  };
  const errors: Partial<Record<ShippingField, string>> = {};

  if (data.name.split(" ").filter((w) => w.length >= 2).length < 2) errors.name = "Escribe nombre y apellidos.";
  const phone = normalizeShippingPhone(data.phone);
  if (!phone) errors.phone = "Teléfono no válido (incluye el prefijo si no es español).";
  if (data.address.length < 5) errors.address = "Indica calle, número y piso.";
  if (isSpain(data.country) ? !/^\d{5}$/.test(data.postalCode) : !/^[A-Z0-9][A-Z0-9 -]{2,10}$/.test(data.postalCode)) {
    errors.postalCode = "Código postal no válido.";
  }
  if (data.city.length < 2) errors.city = "Indica la ciudad.";
  if (data.province.length < 2) errors.province = "Indica la provincia.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { ...data, phone: phone as string } };
}

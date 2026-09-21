import test from "node:test";
import assert from "node:assert/strict";

const { validateShippingInput, normalizeShippingPhone } = await import("../../lib/shipping-validation.ts");

const good = {
  name: "Ikbel Dridi",
  phone: "612 345 678",
  address: "Calle Larios 5, 2º B",
  postalCode: "29005",
  city: "Málaga",
  province: "Málaga",
  country: "",
};

test("datos completos: válidos, país por defecto España y teléfono normalizado", () => {
  const r = validateShippingInput(good);
  assert.equal(r.ok, true);
  assert.equal((r as any).data.country, "España");
  assert.equal((r as any).data.phone, "+34612345678");
});

test("nombre de una sola palabra: inválido", () => {
  const r = validateShippingInput({ ...good, name: "Ikbel" });
  assert.equal(r.ok, false);
  assert.ok((r as any).errors.name);
});

test("teléfonos: internacional con + o 00 vale; basura no", () => {
  assert.equal(normalizeShippingPhone("+216 20 123 456"), "+21620123456");
  assert.equal(normalizeShippingPhone("0033 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizeShippingPhone("12345"), null);
  assert.equal(normalizeShippingPhone("abc"), null);
});

test("código postal español debe tener 5 cifras; extranjero admite letras", () => {
  assert.equal(validateShippingInput({ ...good, postalCode: "2900" }).ok, false);
  assert.equal(validateShippingInput({ ...good, country: "Francia", postalCode: "75001" }).ok, true);
  assert.equal(validateShippingInput({ ...good, country: "Reino Unido", postalCode: "SW1A 1AA" }).ok, true);
});

test("faltan dirección, ciudad o provincia: inválido con error por campo", () => {
  const r = validateShippingInput({ ...good, address: "", city: "", province: "" });
  assert.equal(r.ok, false);
  const e = (r as any).errors;
  assert.ok(e.address && e.city && e.province);
});

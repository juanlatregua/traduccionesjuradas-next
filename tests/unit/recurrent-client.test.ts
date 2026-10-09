import test from "node:test";
import assert from "node:assert/strict";
import { pickBillingToInherit, type BillingRow, classifyRecurrent, recurrentLabel, recurrentClientLine, trustLine, type PaidOrderRow } from "../../lib/recurrent-client.ts";

const d = (s: string) => new Date(s);
const orders: PaidOrderRow[] = [
  { reference: "2026-00010", clientEmail: "Ana@Ejemplo.com", clientPhone: "+34 658 40 41 51", amountCents: 6050, paidAt: d("2026-06-01"), createdAt: d("2026-05-30") },
  { reference: "2026-00090", clientEmail: "ana@ejemplo.com", clientPhone: null, amountCents: 12100, paidAt: d("2026-09-10"), createdAt: d("2026-09-09") },
  { reference: "2026-00050", clientEmail: "otro@x.com", clientPhone: "600111222", amountCents: 3000, paidAt: null, createdAt: d("2026-07-01") },
];

test("email con mayúsculas y espacios casa: recurrente con último pedido", () => {
  const m = classifyRecurrent({ email: "  ANA@ejemplo.COM " }, orders);
  assert.equal(m.kind, "recurrent");
  assert.equal(m.orders, 2);
  assert.equal(m.lastReference, "2026-00090");
  assert.equal(m.lastAmountCents, 12100);
  assert.match(recurrentLabel(m), /^Cliente recurrente · 2 pedidos · último 10\/09\/2026 · 121\.00 €$/);
});

test("teléfono con y sin prefijo casa por los 9 últimos dígitos", () => {
  for (const phone of ["658404151", "+34658404151", "0034 658 40 41 51"]) {
    const m = classifyRecurrent({ email: "nuevo@y.com", phone }, orders);
    assert.equal(m.kind, "possible", phone);
  }
});

test("sin coincidencia: none", () => {
  assert.deepEqual(classifyRecurrent({ email: "nadie@z.com", phone: "611000999" }, orders), { kind: "none" });
  assert.deepEqual(classifyRecurrent({}, orders), { kind: "none" });
  assert.deepEqual(classifyRecurrent({ email: "ana@ejemplo.com" }, []), { kind: "none" });
});

test("teléfono igual y email distinto: solo «posible», sin línea para el cliente", () => {
  const m = classifyRecurrent({ email: "nuevo@y.com", phone: "658404151" }, orders);
  assert.equal(m.kind, "possible");
  assert.equal(m.email, "ana@ejemplo.com");
  assert.match(recurrentLabel(m), /^Posible recurrente \(mismo teléfono, otro email: ana@ejemplo\.com\)/);
  assert.equal(recurrentClientLine(m, "es"), "");
});

test("el email manda sobre el teléfono", () => {
  const m = classifyRecurrent({ email: "otro@x.com", phone: "658404151" }, orders);
  assert.equal(m.kind, "recurrent");
  assert.equal(m.lastReference, "2026-00050");
});

test("línea al cliente solo si recurrente, en su idioma", () => {
  const m = classifyRecurrent({ email: "ana@ejemplo.com" }, orders);
  assert.match(recurrentClientLine(m, "es"), /historial con nosotros\.$/);
  assert.match(recurrentClientLine(m, "fr"), /historique/);
  assert.equal(recurrentClientLine({ kind: "none" }, "es"), "");
});

test("línea de confianza: con y sin cifra de reseñas", () => {
  assert.equal(trustLine("es", 49), "Traductor jurado MAEC nº 3850 · 49 reseñas en Google");
  assert.equal(trustLine("es", null), "Traductor jurado MAEC nº 3850");
  assert.equal(trustLine("fr", 49), "Traducteur assermenté MAEC nº 3850 · 49 avis sur Google");
});

const fila = (fiscalName: string, nif: string): BillingRow => ({ fiscalName, nif, address: "C/ Mayor 1", city: "Málaga", postalCode: "29001", country: "España" });

test("facturación: un solo titular (aunque varios pedidos) se hereda, el más reciente", () => {
  const r = pickBillingToInherit([fila("Ana Pérez", "12345678z"), fila("ANA  PEREZ", "12345678Z")]);
  assert.equal(r.kind, "inherit");
  if (r.kind === "inherit") assert.equal(r.billing.fiscalName, "Ana Pérez");
});

test("facturación: despacho y particular con el mismo email → varios titulares, no se copia", () => {
  const r = pickBillingToInherit([fila("Miquela Fortuny", "11111111H"), fila("NADALFORTUNYLEGAL SLP", "B12345678")]);
  assert.deepEqual(r, { kind: "multiple", holders: 2 });
});

test("facturación: sin historial con titular no hay nada que heredar", () => {
  assert.deepEqual(pickBillingToInherit([]), { kind: "none" });
  assert.deepEqual(pickBillingToInherit([fila("  ", "")]), { kind: "none" });
});

test("titular único: particular (DNI/NIE) se hereda, empresa (CIF) solo se marca", () => {
  const b = (nif: string, fiscalName = "X"): BillingRow => ({ fiscalName, nif, address: "a", city: "c", postalCode: "1", country: "ES" });
  assert.equal(pickBillingToInherit([b("12345678Z")]).kind, "inherit");
  assert.equal(pickBillingToInherit([b("X1234567L")]).kind, "inherit");
  assert.equal(pickBillingToInherit([b("", "Ana Pérez")]).kind, "inherit");
  for (const cif of ["B12345678", "A1234567B", "J1234567A", "N1234567A", "P1234567A", "S1234567A", "U12345678", "V12345678", "W1234567A", "b-12.345.678"]) {
    const r = pickBillingToInherit([b(cif, "Despacho SL")]);
    assert.equal(r.kind, "company", cif);
    if (r.kind === "company") assert.equal(r.name, "Despacho SL");
  }
});

test("el email-marcador de WhatsApp no es 'recurrente por email': solo teléfono", () => {
  const rows: PaidOrderRow[] = [{ reference: "R1", clientEmail: "34600111222@whatsapp.local", clientPhone: "+34600111222", amountCents: 5000, paidAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") }];
  assert.equal(classifyRecurrent({ email: "34600111222@whatsapp.local", phone: "600111222" }, rows).kind, "possible");
});

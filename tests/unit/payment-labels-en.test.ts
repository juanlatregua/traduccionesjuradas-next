import test from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_ACCOUNTS, transferLinesEn } from "../../lib/payment-labels.ts";

test("transferencia Revolut en inglés: bloque exacto para bancos de EE. UU.", () => {
  const revolut = PAYMENT_ACCOUNTS.revolut;
  assert.equal(revolut.kind, "transfer");
  if (revolut.kind !== "transfer") return;
  assert.deepEqual(transferLinesEn(revolut), [
    "• Beneficiary (account holder): Juan Antonio Silva Moreno",
    "• Beneficiary address: Eugenio Sellés 5, 29017 Málaga, Spain",
    "• IBAN: ES32 1583 0001 1490 2264 2489 — (no spaces: ES3215830001149022642489)",
    "• SWIFT / BIC: REVOESM2",
    "• Bank name: Revolut Bank UAB",
    "• Bank address: Calle Príncipe de Vergara 132, 4th floor, 28002 Madrid, Spain",
    "• Currency: EUR (euros)",
  ]);
});

test("ninguna cuenta de transferencia deja 'España' en el bloque inglés", () => {
  for (const account of Object.values(PAYMENT_ACCOUNTS)) {
    if (account.kind !== "transfer") continue;
    for (const line of transferLinesEn(account)) assert.ok(!line.includes("España"), line);
  }
});

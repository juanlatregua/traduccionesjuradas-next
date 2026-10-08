import test from "node:test";
import assert from "node:assert/strict";
import { PersonIndex, personKeys, textKeys, chaseState, consolidate, duplicateOf, primaryKey, MARK_POSPONER, MARK_TRATADO, type RawAction } from "../../lib/vigia-persona.ts";

const d = (s: string) => new Date(s);
const NOW = d("2026-10-08T09:00:00Z");

test("Yannick: dos emails y dos sesiones del mismo PDF son una persona; el lead queda cubierto por el presupuesto", () => {
  const lead1 = personKeys({ emails: ["Yannick.Lliso@gmail.com "], sessions: ["S1"], hashes: ["H1"] });
  const lead2 = personKeys({ emails: ["pasllisa@hotmail.com"], sessions: ["S2"], hashes: ["H1"] });
  const quote = personKeys({ emails: ["pasllisa@hotmail.com"], quoteIds: ["Q232"] });
  const sol = personKeys({ refs: ["puerta:S1"] });
  const idx = new PersonIndex([lead1, lead2, quote, sol].map((keys) => ({ keys })));
  const root = idx.rootOf(lead1);
  assert.ok(root);
  assert.equal(idx.rootOf(lead2), root);
  assert.equal(idx.rootOf(quote), root, "el presupuesto de la otra dirección cubre al lead");
  assert.equal(idx.rootOf(sol), root, "la solicitud por sesión también");
});

test("Susana: solicitud SENT duplicada de otra PRICED con presupuesto → retirar, no «sin precio»", () => {
  const sols = [
    { ref: "LEAD-707DACB6BC", par: "ES>PT", status: "SENT", quoteId: null, createdAt: d("2026-10-06T10:00:00Z") },
    { ref: "LEAD-6656044546", par: "ES>PT", status: "PRICED", quoteId: "Q229", createdAt: d("2026-10-05T10:00:00Z") },
  ];
  const quotes = [{ numero: "2026-00229", par: "es→pt", createdAt: d("2026-10-06T11:00:00Z") }];
  const r = duplicateOf(sols[0], sols, quotes);
  assert.equal(r.hermana?.ref, "LEAD-6656044546");
  assert.equal(r.quote?.numero, "2026-00229");
  // Otro par o sin hermanas: no es duplicada.
  assert.deepEqual(duplicateOf(sols[0], [sols[0]], []), { hermana: null, quote: null });
  assert.equal(duplicateOf({ ...sols[0], par: "ES>EN" }, sols, quotes).hermana, null);
});

test("Paloma: dos presupuestos de la misma persona salen en UNA fila", () => {
  const a = personKeys({ emails: ["pbianca.moura@gmail.com"], phones: ["+55 11 96044-6134"] });
  const b = personKeys({ emails: ["pbianca.moura@gmail.com"], phones: ["11960446134"] });
  const idx = new PersonIndex([a, b].map((keys) => ({ keys })));
  const root = idx.rootOf(a)!;
  assert.equal(idx.rootOf(b), root);
  const acts: RawAction[] = [
    { stake: 1188, urgencia: 2, que: "Presupuesto 00219 1187,92 €", link: "x", key: `p:${root}` },
    { stake: 784, urgencia: 2, que: "Presupuesto 00216 784,08 €", link: "y", key: `p:${root}` },
  ];
  const rows = consolidate(acts);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].que, "Presupuesto 00219 1187,92 €");
  assert.deepEqual(rows[0].extras, ["Presupuesto 00216 784,08 €"]);
});

test("Hella: WhatsApp ya enviado (MessageLog) o marca «Ya lo traté» → oculta; a los 4 días vuelve", () => {
  const wa = [{ channel: "WHATSAPP", type: "DRAFT_WHATSAPP", status: "SENT", at: d("2026-10-07T10:00:00Z") }];
  const c = chaseState(wa, [], NOW);
  assert.equal(c.hidden, true);
  assert.match(c.line, /WhatsApp 7-oct/);
  assert.equal(chaseState([], [{ kind: "tratado", at: d("2026-10-08T07:00:00Z") }], NOW).hidden, true);
  assert.equal(chaseState([], [], NOW).hidden, false);
  // Pasados 4 días desde el último toque vuelve a salir.
  assert.equal(chaseState(wa, [], d("2026-10-11T12:00:00Z")).hidden, false);
  // La marca llegó como MessageLog «manual» del presupuesto.
  assert.equal(chaseState([{ channel: "WHATSAPP", type: "DRAFT_WHATSAPP", status: "SENT", at: d("2026-10-08T07:00:00Z"), body: MARK_TRATADO }], [], NOW).hidden, true);
});

test("Posponer 7 días oculta una semana aunque no haya contacto; PENDING no cuenta como toque", () => {
  const pos = [{ channel: "WHATSAPP", type: "DRAFT_WHATSAPP", status: "SENT", at: d("2026-10-07T07:00:00Z"), body: MARK_POSPONER }];
  assert.equal(chaseState(pos, [], NOW).hidden, true);
  assert.equal(chaseState(pos, [], d("2026-10-14T00:00:00Z")).hidden, true);
  assert.equal(chaseState(pos, [], d("2026-10-14T10:00:00Z")).hidden, false);
  assert.equal(chaseState(pos, [], NOW).touches, 0);
  assert.equal(chaseState([{ channel: "WHATSAPP", type: "DRAFT_WHATSAPP", status: "PENDING", at: d("2026-10-07T00:00:00Z") }], [], NOW).hidden, false);
});

test("dos toques sin respuesta se cuentan (recordatorio + WhatsApp)", () => {
  const logs = [
    { channel: "EMAIL", type: "REMINDER", status: "SENT", at: d("2026-09-19T10:00:00Z") },
    { channel: "WHATSAPP", type: "DRAFT_WHATSAPP", status: "SENT", at: d("2026-09-25T10:00:00Z") },
    { channel: "EMAIL", type: "PAY_LINK", status: "SENT", at: d("2026-09-18T10:00:00Z") },
  ];
  const c = chaseState(logs, [], NOW, 3);
  assert.equal(c.touches, 2);
  assert.equal(c.hidden, false);
  assert.match(c.line, /abierto 3 veces/);
});

test("26_88A72C: «sin traductor» y «sin fecha» del mismo pedido son una fila, y un pedido pagado va antes que un lead", () => {
  const acts: RawAction[] = [
    { stake: 90, urgencia: 3, que: "Lead x@y.com: toque humano", link: "l", key: "p:abc", tier: 1 },
    { stake: 120, urgencia: 5, que: "Pedido 26_88A72C pagado SIN TRADUCTOR", link: "o", key: "o:26_88A72C", tier: 0 },
    { stake: 120, urgencia: 4, que: "Pedido 26_88A72C SIN FECHA DE ENTREGA", link: "o", key: "o:26_88A72C", tier: 0 },
  ];
  const rows = consolidate(acts);
  assert.equal(rows.length, 2);
  assert.match(rows[0].que, /SIN TRADUCTOR/);
  assert.deepEqual(rows[0].extras, ["Pedido 26_88A72C SIN FECHA DE ENTREGA"]);
});

test("teléfonos: <dígitos>@whatsapp.local y +34 con espacios son la misma clave; un intermediario no une personas", () => {
  assert.deepEqual(personKeys({ emails: ["212772303735@whatsapp.local"] }), ["p:772303735"]);
  assert.deepEqual(personKeys({ phones: ["+212 772-303-735"] }), ["p:772303735"]);
  assert.deepEqual(textKeys("Hella · hellatiti@Hotmail.fr · +212 772 303 735"), ["e:hellatiti@hotmail.fr", "p:772303735"]);
  const items = ["a@x.com", "b@x.com", "c@x.com", "d@x.com"].map((e) => ({ keys: personKeys({ emails: [e], phones: ["600111222"] }) }));
  const idx = new PersonIndex(items);
  assert.notEqual(idx.rootOf(items[0].keys), idx.rootOf(items[1].keys));
  assert.equal(primaryKey(["e:a@x.com", "p:123456789"]), "p:123456789");
});

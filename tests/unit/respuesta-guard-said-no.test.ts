import test from "node:test";
import assert from "node:assert/strict";
import { clientSaidNo, expandIdentity, type SaidNoFacts } from "../../lib/respuesta-guard.ts";

const d = (s: string) => new Date(s);
const NOW = d("2026-10-09T12:00:00Z");
const NONE: SaidNoFacts = { inbound: [], quotes: [], casos: [] };
const cli = expandIdentity({ email: "cli@mail.com" }, []);
const quote = (o: Partial<SaidNoFacts["quotes"][number]>): SaidNoFacts["quotes"][number] => ({ ref: "Q1", email: "cli@mail.com", updatedAt: d("2026-10-08T00:00:00Z"), ...o });

test("clientSaidNo: escribió en 14 días → respondio; autorrespuesta, ajeno, propio o fuera de ventana no", () => {
  const inb = (o: object) => ({ id: "i1", email: "cli@mail.com", at: d("2026-10-08T10:00:00Z"), subject: "Re: presupuesto", ...o });
  assert.deepEqual(clientSaidNo(cli, { ...NONE, inbound: [inb({})] }, NOW), { reason: "respondio", ref: "i1" });
  assert.equal(clientSaidNo(cli, { ...NONE, inbound: [inb({ subject: "Réponse automatique : absent" })] }, NOW), null);
  assert.equal(clientSaidNo(cli, { ...NONE, inbound: [inb({ email: "otro@mail.com" })] }, NOW), null);
  assert.equal(clientSaidNo(cli, { ...NONE, inbound: [inb({ at: d("2026-09-20T10:00:00Z") })] }, NOW), null);
  assert.equal(clientSaidNo(cli, { ...NONE, inbound: [inb({})] }, NOW, { since: d("2026-10-09T00:00:00Z") }), null);
  assert.equal(clientSaidNo(cli, { ...NONE, inbound: [inb({})] }, NOW, { isOwn: () => true }), null);
});

test("clientSaidNo: WhatsApp por teléfono de la identidad", () => {
  const id = expandIdentity({ email: "cli@mail.com", phone: "612345678" }, []);
  const r = clientSaidNo(id, { ...NONE, inbound: [{ id: "w1", email: "612345678@whatsapp.local", phone: "+34612345678", at: d("2026-10-08T10:00:00Z") }] }, NOW);
  assert.equal(r?.reason, "respondio");
});

test("clientSaidNo: presupuesto perdido (SOLVED_ELSEWHERE caducado) → perdido", () => {
  const r = clientSaidNo(cli, { ...NONE, quotes: [quote({ lostReason: "SOLVED_ELSEWHERE", expiredAt: d("2026-10-05T00:00:00Z") })] }, NOW);
  assert.deepEqual(r, { reason: "perdido", ref: "Q1" });
  assert.equal(clientSaidNo(cli, { ...NONE, quotes: [quote({ lostReason: "PRICE", expiredAt: d("2026-08-01T00:00:00Z") })] }, NOW), null);
  assert.equal(clientSaidNo(cli, { ...NONE, quotes: [quote({ lostFeedbackAt: d("2026-10-01T00:00:00Z") })] }, NOW)?.reason, "perdido");
});

test("clientSaidNo: el cierre automático sin respuesta NO cuenta como «dijo que no»", () => {
  const auto = quote({ lostReason: "NO_LONGER_NEEDED", lostReasonNote: "auto:sin_respuesta", lostFeedbackAt: d("2026-10-08T00:00:00Z") });
  assert.equal(clientSaidNo(cli, { ...NONE, quotes: [auto] }, NOW), null);
});

test("clientSaidNo: solo caso CANCELADO bloquea; PERDIDO (lo pone el sistema), ENTREGADO y ABIERTO no", () => {
  const caso = (estado: string) => ({ ref: "CASO-1", estado, email: "cli@mail.com", lastActivityAt: d("2026-10-01T00:00:00Z") });
  assert.equal(clientSaidNo(cli, { ...NONE, casos: [caso("PERDIDO")] }, NOW), null);
  assert.equal(clientSaidNo(cli, { ...NONE, casos: [caso("CANCELADO")] }, NOW)?.reason, "caso_cerrado");
  assert.equal(clientSaidNo(cli, { ...NONE, casos: [caso("ENTREGADO")] }, NOW), null);
  assert.equal(clientSaidNo(cli, { ...NONE, casos: [caso("ABIERTO")] }, NOW), null);
});

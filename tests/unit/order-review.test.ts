import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
// @ts-ignore — registerHooks is a newer Node API not yet in @types/node
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import {
  handleReviewPost,
  parseStars,
  resolveReviewOrder,
  reviewPageModel,
  reviewStaffSubject,
  type ReviewDeps,
  type ReviewOrder,
  type ReviewPayload,
} from "../../lib/order-review.ts";

registerHooks({
  resolve(specifier: string, context: unknown, nextResolve: Function) {
    if (specifier === "@/lib/prisma") {
      return nextResolve(pathToFileURL(path.resolve(process.cwd(), "lib/prisma.ts")).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const ORDER: ReviewOrder = { id: "o1", reference: "26_ABC", clientName: "Marie Dupont", clientEmail: "marie@x.fr", clientLocale: "fr" };

function fakeDeps(over: Partial<ReviewDeps> = {}) {
  const events: { id: string; orderId: string; message: string; payload: ReviewPayload }[] = [];
  const mails: { subject: string; text: string }[] = [];
  const deps: ReviewDeps = {
    verifyOrderToken: (ref, t) => ref === "26_ABC" && t === "good",
    findOrder: async (ref) => (ref === ORDER.reference ? ORDER : null),
    findReview: async (orderId) => events.find((e) => e.orderId === orderId) ?? null,
    createReview: async (orderId, message, payload) => {
      events.push({ id: `e${events.length + 1}`, orderId, message, payload });
    },
    updateReview: async (id, message, payload) => {
      const e = events.find((x) => x.id === id)!;
      e.message = message;
      e.payload = payload;
    },
    rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
    notifyStaff: async (subject, text) => {
      mails.push({ subject, text });
    },
    ...over,
  };
  return { deps, events, mails };
}

const post = (deps: ReviewDeps, extra: Record<string, unknown> = {}) =>
  handleReviewPost({ reference: "26_ABC", t: "good", r: "5", ip: "1.2.3.4", ...extra }, deps);

test("parseStars: solo 1..5 enteros", () => {
  assert.equal(parseStars("1"), 1);
  assert.equal(parseStars(5), 5);
  for (const bad of ["0", "6", "-1", "4.5", "abc", "", undefined, null, "55"]) assert.equal(parseStars(bad), null);
});

test("token válido abre el pedido; inválido o vacío no", async () => {
  const { deps } = fakeDeps();
  assert.equal((await resolveReviewOrder("26_ABC", "good", deps))?.id, "o1");
  assert.equal(await resolveReviewOrder("26_ABC", "bad", deps), null);
  assert.equal(await resolveReviewOrder("26_ABC", "", deps), null);
});

test("sin gating: Google sale primero con r=1 y en todas las notas; también con token malo", async () => {
  const { deps } = fakeDeps();
  for (const r of ["1", "2", "3", "4", "5"]) {
    const m = await reviewPageModel("26_ABC", "good", r, deps);
    assert.equal(m.view, "thanks");
    assert.deepEqual(m.actions, ["google", "comment"]);
  }
  const bad = await reviewPageModel("26_ABC", "bad", "1", deps);
  assert.equal(bad.view, "invalid");
  assert.deepEqual(bad.actions, ["google"]);
  assert.equal((await reviewPageModel("26_ABC", "good", "9", deps)).view, "invalid");
});

test("token inválido: 403 y no se guarda nada", async () => {
  const { deps, events } = fakeDeps();
  const res = await post(deps, { t: "bad" });
  assert.equal(res.status, 403);
  assert.equal(events.length, 0);
});

test("r fuera de 1..5: 400 y no se guarda nada", async () => {
  const { deps, events } = fakeDeps();
  for (const r of ["0", "6", "x", undefined]) assert.equal((await post(deps, { r })).status, 400);
  assert.equal(events.length, 0);
});

test("la nota se actualiza sin duplicar y el evento dice «Valoración: N★»", async () => {
  const { deps, events } = fakeDeps();
  assert.equal((await post(deps, { r: "5" })).status, 200);
  assert.equal((await post(deps, { r: "5" })).status, 200);
  assert.equal((await post(deps, { r: "2" })).status, 200);
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.stars, 2);
  assert.equal(events[0].message, "Valoración: 2★");
});

test("comentario: se guarda, conserva la nota y avisa al staff; nota ≤3 en el asunto", async () => {
  const { deps, events, mails } = fakeDeps();
  await post(deps, { r: "3" });
  const res = await post(deps, { r: "3", comment: "  Tardó un poco  " });
  assert.equal(res.status, 200);
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.comment, "Tardó un poco");
  assert.equal(events[0].message, "Valoración: 3★ · «Tardó un poco»");
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /Nota baja \(3★\)/);
  assert.match(mails[0].text, /Tardó un poco/);
  assert.doesNotMatch(reviewStaffSubject("26_ABC", 4), /Nota baja/);
  await post(deps, { r: "4" });
  assert.equal(events[0].payload.comment, "Tardó un poco");
});

test("comentario vacío no avisa; solo estrellas tampoco", async () => {
  const { deps, mails } = fakeDeps();
  assert.equal((await post(deps, { comment: "   " })).status, 400);
  await post(deps);
  assert.equal(mails.length, 0);
});

test("rate limit (helper real en memoria): el 6.º comentario da 429", async () => {
  const prev = process.env.RATE_LIMIT_STORE;
  process.env.RATE_LIMIT_STORE = "memory";
  try {
    const { checkRateLimit } = await import("../../lib/rate-limit.ts");
    const { deps } = fakeDeps({ rateLimit: (key, limit, windowMs) => checkRateLimit({ key, limit, windowMs }) });
    const ip = `9.9.9.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 5; i++) {
      assert.equal((await handleReviewPost({ reference: "26_ABC", t: "good", r: "4", comment: `c${i}`, ip }, deps)).status, 200);
    }
    assert.equal((await handleReviewPost({ reference: "26_ABC", t: "good", r: "4", comment: "otra", ip }, deps)).status, 429);
  } finally {
    if (prev === undefined) delete process.env.RATE_LIMIT_STORE;
    else process.env.RATE_LIMIT_STORE = prev;
  }
});

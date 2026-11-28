import test from "node:test";
import assert from "node:assert/strict";
import {
  applyReferralCodeToQuote,
  computeReferralDiscount,
  ensureReferralCodeForOrder,
  generateReferralCode,
  markReferralEarnedForPaidOrder,
  normalizeCodeInput,
  redeemOwnerCreditOnQuote,
  referralInvoiceLines,
  voidReferralRewardForOrder,
} from "../../lib/referral-core.ts";

// ── Doble en memoria de Prisma: where con igualdad/null/gt/in/equals+mode/OR,
// únicos que lanzan P2002 y transacciones con deshacer (rollback real). ──────

type Row = Record<string, any>;
const UNIQUES: Record<string, string[]> = {
  referralCode: ["code", "sourceOrderId", "usedByCustomerId", "usedOnQuoteId", "usedOnOrderId", "rewardRedeemedOnQuoteId"],
  customer: ["email"],
  quote: [],
  order: [],
};

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Row[]).some((w) => matches(row, w));
    const v = row[k];
    if (cond === null) return v === null || v === undefined;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond === "object") {
      if ("gt" in cond) return v != null && (v instanceof Date ? v.getTime() > cond.gt.getTime() : Number(v) > Number(cond.gt));
      if ("in" in cond) return cond.in.includes(v);
      if ("equals" in cond) return String(v || "").toLowerCase() === String(cond.equals).toLowerCase();
      if ("not" in cond) return v !== cond.not;
    }
    if (typeof cond === "number") return Number(v) === cond;
    return v === cond;
  });
}

const tick = () => new Promise((r) => setImmediate(r));

function makeDb(seed: { quotes?: Row[]; customers?: Row[]; codes?: Row[]; orders?: Row[] }) {
  const store: Record<string, Row[]> = {
    quote: seed.quotes || [],
    customer: seed.customers || [],
    referralCode: seed.codes || [],
    order: seed.orders || [],
  };
  let seq = 0;
  function model(name: string, undo: (() => void)[] | null) {
    const rows = () => store[name];
    const checkUnique = (candidate: Row, self?: Row) => {
      for (const f of UNIQUES[name]) {
        if (candidate[f] == null) continue;
        if (rows().some((r) => r !== self && r[f] === candidate[f])) throw Object.assign(new Error("unique"), { code: "P2002", meta: { target: [f] } });
      }
    };
    return {
      async findUnique({ where }: Row) {
        await tick();
        return rows().find((r) => matches(r, where)) ?? null;
      },
      async findFirst({ where, orderBy }: Row) {
        await tick();
        let list = rows().filter((r) => matches(r, where));
        if (orderBy) {
          const [[k, dir]] = Object.entries(orderBy) as [string, string][];
          list = [...list].sort((a, b) => (+(a[k] ?? 0) - +(b[k] ?? 0)) * (dir === "desc" ? -1 : 1));
        }
        return list[0] ?? null;
      },
      async findMany({ where }: Row) {
        await tick();
        return rows().filter((r) => matches(r, where));
      },
      async count({ where }: Row) {
        await tick();
        return rows().filter((r) => matches(r, where)).length;
      },
      async create({ data }: Row) {
        await tick();
        const row = { id: `${name}-${++seq}`, createdAt: new Date(), usedAt: null, rewardStatus: "NONE", rewardRedeemedOnQuoteId: null, ...data };
        checkUnique(row);
        rows().push(row);
        undo?.push(() => store[name].splice(store[name].indexOf(row), 1));
        return row;
      },
      async updateMany({ where, data }: Row) {
        await tick();
        const hit = rows().filter((r) => matches(r, where));
        for (const r of hit) {
          checkUnique({ ...r, ...data }, r);
          const prev = { ...r };
          Object.assign(r, data);
          undo?.push(() => {
            for (const k of Object.keys(r)) delete r[k];
            Object.assign(r, prev);
          });
        }
        return { count: hit.length };
      },
    };
  }
  const api = (undo: (() => void)[] | null): any => ({
    quote: model("quote", undo),
    customer: model("customer", undo),
    referralCode: model("referralCode", undo),
    order: model("order", undo),
  });
  const db = api(null);
  db.$transaction = async (fn: (tx: any) => Promise<any>) => {
    const undo: (() => void)[] = [];
    try {
      return await fn(api(undo));
    } catch (e) {
      for (const u of undo.reverse()) u();
      throw e;
    }
  };
  db.store = store;
  return db;
}

const NOW = new Date("2026-11-28T10:00:00Z");
const FUTURE = new Date("2027-01-01T00:00:00Z");

function quote(id: string, over: Row = {}): Row {
  const lines = over.lines ?? [{ description: "Acta de nacimiento", quantity: 2, unitPrice: 30, supplierUnitCost: null }];
  const sub = lines.reduce((a: number, l: Row) => a + l.quantity * l.unitPrice, 0);
  const ship = over.deliveryType === "PAPER_SHIP" ? 12 : 0;
  const disc = over.discountAmount ?? 0;
  const base = sub + ship - disc;
  return {
    id,
    status: "SENT",
    customerId: `cust-${id}`,
    customerEmail: `${id}@cliente.es`,
    customerPhone: null,
    sourceLang: "fr",
    targetLang: "es",
    deliveryType: "DIGITAL_PDF",
    shippingBase: 12,
    vatRate: 0.21,
    discountType: "NONE",
    discountValue: 0,
    discountAmount: 0,
    total: Math.round(base * 1.21 * 100) / 100,
    paidAt: null,
    validUntil: FUTURE,
    sendingAt: null,
    deletedAt: null,
    supersededAt: null,
    paymentFrozenAt: null,
    balanceAmount: null,
    orders: [],
    ...over,
    lines,
  };
}

function code(over: Row = {}): Row {
  return {
    id: "rc-1",
    code: "MARIE-7K2Q",
    ownerCustomerId: "cust-owner",
    ownerEmail: "marie@ejemplo.fr",
    ownerPhone: "600111222",
    sourceOrderId: "ord-src",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    expiresAt: new Date("2027-06-01T00:00:00Z"),
    usedAt: null,
    usedByCustomerId: null,
    usedOnQuoteId: null,
    usedOnOrderId: null,
    rewardStatus: "NONE",
    rewardRedeemedOnQuoteId: null,
    ...over,
  };
}

const OWNER = { id: "cust-owner", name: "Marie Dupont", email: "marie@ejemplo.fr", phone: "+34 600 111 222" };

test("formato: normaliza minúsculas, espacios y guion ausente; rechaza ambiguos", () => {
  assert.equal(normalizeCodeInput(" marie 7k2q "), "MARIE-7K2Q");
  assert.equal(normalizeCodeInput("marie-7k2q"), "MARIE-7K2Q");
  assert.equal(normalizeCodeInput("MARIE-7K2O"), null); // O ambigua
  assert.equal(normalizeCodeInput(""), null);
  const c = generateReferralCode("Hélène Martín", "x@y.z", () => 0.5);
  assert.match(c, /^HELENE-[A-HJKMNP-Z2-9]{4}$/);
});

test("10 % sobre la base y el IVA sobre la base descontada (FR, Juan sin suelo)", async () => {
  const db = makeDb({ quotes: [quote("q1")], customers: [OWNER], codes: [code()] });
  const r = await applyReferralCodeToQuote(db, { quoteId: "q1", code: "marie-7k2q", now: NOW });
  assert.equal(r.ok, true);
  const q = db.store.quote[0];
  assert.equal(q.discountType, "FIXED");
  assert.equal(q.discountAmount, 6); // 10 % de 60
  assert.equal(q.vatAmount, 11.34); // 21 % de 54
  assert.equal(q.total, 65.34);
  assert.equal(db.store.referralCode[0].rewardStatus, "PENDING");
});

test("papel: el envío no entra en el 10 % pero el IVA va sobre base + envío − descuento", async () => {
  const db = makeDb({ quotes: [quote("q1", { deliveryType: "PAPER_SHIP" })], customers: [OWNER], codes: [code()] });
  const r = await applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(r.ok, true);
  const q = db.store.quote[0];
  assert.equal(q.discountAmount, 6);
  assert.equal(q.vatAmount, 13.86); // 21 % de 66
  assert.equal(q.total, 79.86);
});

test("suelo lavori: se recorta a coste × 1,10 y queda rastro", () => {
  const d = computeReferralDiscount({ lines: [{ quantity: 1, unitPrice: 100, supplierUnitCost: 85 }], isFrench: false });
  assert.equal(d.ok, true);
  if (!d.ok) return;
  assert.equal(d.requestedCents, 1000);
  assert.equal(d.floorCents, 9350);
  assert.equal(d.discountCents, 650);
  assert.equal(d.clamped, true);
  assert.match(String(d.note), /suelo/);
});

test("suelo lavori: sin hueco no se aplica; sin coste conocido tampoco", async () => {
  assert.deepEqual(computeReferralDiscount({ lines: [{ quantity: 1, unitPrice: 100, supplierUnitCost: 95 }], isFrench: false }).ok, false);
  const unknown = computeReferralDiscount({ lines: [{ quantity: 1, unitPrice: 100, supplierUnitCost: null }], isFrench: false });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.code, "COSTE_DESCONOCIDO");

  const db = makeDb({
    quotes: [quote("q1", { sourceLang: "pt", lines: [{ description: "Certidão", quantity: 1, unitPrice: 80, supplierUnitCost: null }] })],
    customers: [OWNER],
    codes: [code()],
  });
  const r = await applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "COSTE_DESCONOCIDO");
  assert.equal(db.store.referralCode[0].usedAt, null, "el código sigue libre");
  assert.equal(db.store.quote[0].discountAmount, 0);
});

test("lavori con hueco: el presupuesto queda en el suelo exacto", async () => {
  const db = makeDb({
    quotes: [quote("q1", { sourceLang: "de", lines: [{ description: "Urkunde", quantity: 1, unitPrice: 100, supplierUnitCost: 85 }] })],
    customers: [OWNER],
    codes: [code()],
  });
  const r = await applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(r.ok, true);
  assert.equal(db.store.quote[0].discountAmount, 6.5);
  assert.equal(db.store.referralCode[0].floorClamped, true);
});

test("autouso rechazado: mismo Customer, mismo email o mismo teléfono", async () => {
  for (const over of [{ customerId: "cust-owner" }, { customerEmail: "MARIE@ejemplo.fr" }, { customerPhone: "0034600111222" }]) {
    const db = makeDb({ quotes: [quote("q1", over)], customers: [OWNER], codes: [code()] });
    const r = await applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "AUTOUSO", JSON.stringify(over));
  }
});

test("doble uso rechazado y caducado rechazado", async () => {
  const used = makeDb({ quotes: [quote("q1")], customers: [OWNER], codes: [code({ usedAt: NOW, usedByCustomerId: "otro" })] });
  const r1 = await applyReferralCodeToQuote(used, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(!r1.ok && r1.reason, "YA_USADO");

  const old = makeDb({ quotes: [quote("q1")], customers: [OWNER], codes: [code({ expiresAt: new Date("2026-11-01T00:00:00Z") })] });
  const r2 = await applyReferralCodeToQuote(old, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(!r2.ok && r2.reason, "CADUCADO");
});

test("carrera: dos invitados con el mismo código a la vez → solo uno", async () => {
  const db = makeDb({ quotes: [quote("q1"), quote("q2")], customers: [OWNER], codes: [code()] });
  const [a, b] = await Promise.all([
    applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW }),
    applyReferralCodeToQuote(db, { quoteId: "q2", code: "MARIE-7K2Q", now: NOW }),
  ]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
  assert.equal(db.store.quote.filter((q: Row) => q.discountAmount > 0).length, 1, "solo un presupuesto descontado");
});

test("carrera: dos códigos a la vez en el mismo presupuesto → uno; el otro queda libre (rollback)", async () => {
  const db = makeDb({
    quotes: [quote("q1")],
    customers: [OWNER, { id: "cust-b", email: "b@b.es", phone: null }],
    codes: [code(), code({ id: "rc-2", code: "BRUNO-3H4J", ownerCustomerId: "cust-b", ownerEmail: "b@b.es", ownerPhone: null, sourceOrderId: "ord-b" })],
  });
  const res = await Promise.all([
    applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW }),
    applyReferralCodeToQuote(db, { quoteId: "q1", code: "BRUNO-3H4J", now: NOW }),
  ]);
  assert.equal(res.filter((r) => r.ok).length, 1);
  assert.equal(db.store.referralCode.filter((c: Row) => c.usedAt).length, 1);
  assert.equal(db.store.quote[0].discountAmount, 6, "un solo 10 %, nunca dos");
});

test("un invitado solo usa un código en su vida", async () => {
  const db = makeDb({
    quotes: [quote("q2", { customerId: "cust-inv", customerEmail: "inv@x.es" })],
    customers: [OWNER],
    codes: [code({ id: "rc-0", code: "ANA-2345", ownerCustomerId: "cust-ana", sourceOrderId: "o0", usedAt: NOW, usedByCustomerId: "cust-inv", usedByEmail: "inv@x.es" }), code()],
  });
  const r = await applyReferralCodeToQuote(db, { quoteId: "q2", code: "MARIE-7K2Q", now: NOW });
  assert.equal(!r.ok && r.reason, "INVITADO_YA_USO");
});

test("no se acumula con un descuento manual y lo dice", async () => {
  const db = makeDb({ quotes: [quote("q1", { discountType: "PERCENT", discountValue: 5, discountAmount: 3 })], customers: [OWNER], codes: [code()] });
  const r = await applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "YA_TIENE_DESCUENTO");
    assert.match(r.message, /no se acumulan/);
  }
  assert.equal(db.store.referralCode[0].usedAt, null);
});

test("EARNED solo al pagar, nunca al aplicar; y el dueño lo canjea una vez", async () => {
  const db = makeDb({
    quotes: [quote("q1"), quote("q-owner", { customerId: "cust-owner", customerEmail: "marie@ejemplo.fr" })],
    customers: [OWNER],
    codes: [code()],
  });
  await applyReferralCodeToQuote(db, { quoteId: "q1", code: "MARIE-7K2Q", now: NOW });
  assert.equal(db.store.referralCode[0].rewardStatus, "PENDING");
  const early = await redeemOwnerCreditOnQuote(db, { quoteId: "q-owner", now: NOW });
  assert.equal(!early.ok && early.reason, "SIN_CREDITO", "sin pago del invitado no hay crédito");

  assert.equal(await markReferralEarnedForPaidOrder(db, { orderId: "ord-inv", quoteId: "q1", now: NOW }), 1);
  assert.equal(db.store.referralCode[0].rewardStatus, "EARNED");
  assert.equal(db.store.referralCode[0].usedOnOrderId, "ord-inv");
  assert.equal(await markReferralEarnedForPaidOrder(db, { orderId: "ord-inv", quoteId: "q1", now: NOW }), 0, "webhook repetido: nada");

  const red = await redeemOwnerCreditOnQuote(db, { quoteId: "q-owner", now: NOW });
  assert.equal(red.ok, true);
  assert.equal(db.store.referralCode[0].rewardStatus, "REDEEMED");
  assert.equal(db.store.quote[1].discountAmount, 6);
  const again = await redeemOwnerCreditOnQuote(db, { quoteId: "q-owner", now: NOW });
  assert.equal(again.ok, false);
});

test("devolución o cancelación del invitado → VOID si no se canjeó; si ya se canjeó, se avisa", async () => {
  const db = makeDb({ codes: [code({ usedAt: NOW, usedOnQuoteId: "q1", usedOnOrderId: "ord-inv", rewardStatus: "EARNED" })] });
  const r = await voidReferralRewardForOrder(db, { orderId: "ord-inv", quoteId: "q1", reason: "reembolso", now: NOW });
  assert.equal(r.voided, 1);
  assert.equal(db.store.referralCode[0].rewardStatus, "VOID");
  assert.equal(await markReferralEarnedForPaidOrder(db, { orderId: "ord-inv", quoteId: "q1", now: NOW }), 0, "VOID no revive");

  const pending = makeDb({ codes: [code({ usedAt: NOW, usedOnQuoteId: "q1", rewardStatus: "PENDING" })] });
  assert.equal((await voidReferralRewardForOrder(pending, { orderId: "x", quoteId: "q1", reason: "cancelado", now: NOW })).voided, 1);

  const redeemed = makeDb({ codes: [code({ usedAt: NOW, usedOnOrderId: "ord-inv", rewardStatus: "REDEEMED" })] });
  const rr = await voidReferralRewardForOrder(redeemed, { orderId: "ord-inv", quoteId: null, reason: "reembolso", now: NOW });
  assert.equal(rr.voided, 0);
  assert.deepEqual(rr.alreadyRedeemed, ["MARIE-7K2Q"]);
});

test("emisión idempotente por pedido, un código vivo por cliente y nada sin pagar", async () => {
  const orders = [
    { id: "o1", status: "DELIVERED", paymentStatus: "PAID", billingExcluded: false, clientEmail: "marie@ejemplo.fr", clientName: "Marie Dupont", clientPhone: null, quote: null },
    { id: "o2", status: "DELIVERED", paymentStatus: "PAID", billingExcluded: false, clientEmail: "Marie@Ejemplo.fr", clientName: "Marie", clientPhone: null, quote: null },
    { id: "o3", status: "DELIVERED", paymentStatus: "PENDING", billingExcluded: false, clientEmail: "z@z.es", clientName: "Z", clientPhone: null, quote: null },
  ];
  const db = makeDb({ orders, customers: [{ ...OWNER }] });
  const a = await ensureReferralCodeForOrder(db, { orderId: "o1", now: NOW });
  const b = await ensureReferralCodeForOrder(db, { orderId: "o1", now: NOW });
  const c = await ensureReferralCodeForOrder(db, { orderId: "o2", now: NOW });
  assert.ok(a && /^MARIE-/.test(a.code));
  assert.equal(b?.code, a?.code);
  assert.equal(c?.code, a?.code, "mismo cliente: el mismo código vivo");
  assert.equal(db.store.referralCode.length, 1);
  assert.equal(new Date(a!.expiresAt).toISOString().slice(0, 10), "2027-11-28");
  assert.equal(await ensureReferralCodeForOrder(db, { orderId: "o3", now: NOW }), null);
});

test("factura: línea con el descuento a la vista y base ya descontada", () => {
  const lines = referralInvoiceLines({ baseCents: 5400, discountCents: 600, code: "MARIE-7K2Q", kind: "invitee" });
  assert.equal(lines?.[0].amountCents, 5400);
  assert.match(String(lines?.[0].detail), /60,00 € − descuento por código de recomendación MARIE-7K2Q 6,00 € = base imponible 54,00 €/);
  assert.equal(referralInvoiceLines({ baseCents: 5400, discountCents: 0, code: "X", kind: "invitee" }), null);
});

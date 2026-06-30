"use client";

import { useState } from "react";
import Link from "next/link";
import { getAc, getDeliveryTypeLabel, type AcLang } from "@/lib/i18n/area-cliente";

type OrderClientPanelProps = {
  reference: string;
  lang?: AcLang | string | null;
  deliveryType: string;
  paymentStatus: string;
  hasShipping: boolean;
  hasBilling: boolean;
  billingRequested: boolean;
  invoiceEvents: Array<{ date: string; text: string }>;
  initialShipping?: Partial<ShippingForm> | null;
  initialBilling?: Partial<BillingForm> | null;
};

type ShippingForm = {
  name: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

type BillingForm = {
  requestInvoice: boolean;
  fiscalName: string;
  nif: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
};

const EMPTY_SHIPPING: ShippingForm = {
  name: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  country: "España",
};

const EMPTY_BILLING: BillingForm = {
  requestInvoice: false,
  fiscalName: "",
  nif: "",
  address: "",
  city: "",
  postalCode: "",
  country: "España",
  email: "",
};

function isShippingComplete(data: ShippingForm) {
  return Boolean(
    data.name && data.phone && data.address && data.city && data.province && data.postalCode && data.country
  );
}

function isBillingComplete(data: BillingForm) {
  if (!data.requestInvoice) return false;
  return Boolean(
    data.fiscalName && data.nif && data.address && data.city && data.postalCode && data.country && data.email
  );
}

export default function OrderClientPanel({
  reference,
  lang,
  deliveryType,
  paymentStatus,
  hasShipping,
  hasBilling,
  billingRequested,
  invoiceEvents,
  initialShipping,
  initialBilling,
}: OrderClientPanelProps) {
  const t = getAc(lang).panel;
  const [shipping, setShipping] = useState<ShippingForm>({
    ...EMPTY_SHIPPING,
    ...initialShipping,
  });
  const [billing, setBilling] = useState<BillingForm>({
    ...EMPTY_BILLING,
    requestInvoice: billingRequested,
    ...initialBilling,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestingInvoice, setRequestingInvoice] = useState(false);

  const shippingComplete = isShippingComplete(shipping);
  const billingComplete = isBillingComplete(billing);

  async function saveShipping() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/orders/${reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotice(t.noticeShippingSaved);
      } else {
        setNotice(data.error || t.errShippingSave);
      }
    } catch {
      setNotice(t.errShippingConn);
    } finally {
      setSaving(false);
    }
  }

  async function saveBilling() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/orders/${reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing: {
            fiscalName: billing.fiscalName,
            nif: billing.nif,
            address: billing.address,
            city: billing.city,
            postalCode: billing.postalCode,
            country: billing.country,
            email: billing.email,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotice(t.noticeBillingSaved);
      } else {
        setNotice(data.error || t.errBillingSave);
      }
    } catch {
      setNotice(t.errBillingConn);
    } finally {
      setSaving(false);
    }
  }

  async function requestInvoice() {
    if (!billing.requestInvoice) {
      setNotice(t.errCheckRequest);
      return;
    }
    if (!billingComplete) {
      setNotice(t.errCompleteFiscal);
      return;
    }

    setRequestingInvoice(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/orders/${reference}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalName: billing.fiscalName,
          nif: billing.nif,
          address: billing.address,
          city: billing.city,
          postalCode: billing.postalCode,
          country: billing.country,
          email: billing.email,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotice(t.noticeInvoiceRequested);
      } else {
        setNotice(data.error || t.errInvoiceRequest);
      }
    } catch {
      setNotice(t.errInvoiceConn);
    } finally {
      setRequestingInvoice(false);
    }
  }

  const isPaid = paymentStatus === "PAID";

  return (
    <>
      {/* Shipping */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">{t.deliveryTitle}</h2>
        <p className="mt-2 text-sm text-slate-700">
          {t.modeChosen}:{" "}
          <span className="font-semibold">
            {getDeliveryTypeLabel(deliveryType, lang)}
          </span>
        </p>
        {deliveryType === "envio" ? (
          <>
            <p className="mt-2 text-xs text-slate-600">
              {hasShipping ? t.shippingRegistered : t.shippingMissing}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={shipping.name}
                onChange={(e) => setShipping((p) => ({ ...p, name: e.target.value }))}
                placeholder={t.phName}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.phone}
                onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                placeholder={t.phPhone}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.address}
                onChange={(e) => setShipping((p) => ({ ...p, address: e.target.value }))}
                placeholder={t.phAddress}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={shipping.city}
                onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                placeholder={t.phCity}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.province}
                onChange={(e) => setShipping((p) => ({ ...p, province: e.target.value }))}
                placeholder={t.phProvince}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.postalCode}
                onChange={(e) => setShipping((p) => ({ ...p, postalCode: e.target.value }))}
                placeholder={t.phPostalCode}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.country}
                onChange={(e) => setShipping((p) => ({ ...p, country: e.target.value }))}
                placeholder={t.phCountry}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveShipping}
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {t.saveShipping}
              </button>
              <span className={`text-sm font-semibold ${shippingComplete ? "text-emerald-700" : "text-amber-700"}`}>
                {shippingComplete ? t.shippingComplete : t.shippingPending}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-700">
            {t.noShippingNeeded}
          </p>
        )}
      </section>

      {/* Payment */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">{t.paymentTitle}</h2>
        {isPaid ? (
          <p className="mt-2 text-sm font-semibold text-emerald-700">{t.paymentDone}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              {t.paymentMethods}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/area-cliente/pedido/${reference}/pagar`}
                className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
              >
                {t.goToPay}
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Billing */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">{t.billingTitle}</h2>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={billing.requestInvoice}
            onChange={(e) => setBilling((p) => ({ ...p, requestInvoice: e.target.checked }))}
          />
          {t.requestInvoice}
        </label>
        {billing.requestInvoice && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={billing.fiscalName}
              onChange={(e) => setBilling((p) => ({ ...p, fiscalName: e.target.value }))}
              placeholder={t.phFiscalName}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.nif}
              onChange={(e) => setBilling((p) => ({ ...p, nif: e.target.value }))}
              placeholder={t.phNif}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.address}
              onChange={(e) => setBilling((p) => ({ ...p, address: e.target.value }))}
              placeholder={t.phFiscalAddress}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={billing.city}
              onChange={(e) => setBilling((p) => ({ ...p, city: e.target.value }))}
              placeholder={t.phCity}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.postalCode}
              onChange={(e) => setBilling((p) => ({ ...p, postalCode: e.target.value }))}
              placeholder={t.phPostalCode}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.country}
              onChange={(e) => setBilling((p) => ({ ...p, country: e.target.value }))}
              placeholder={t.phCountry}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.email}
              onChange={(e) => setBilling((p) => ({ ...p, email: e.target.value }))}
              placeholder={t.phInvoiceEmail}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveBilling}
            disabled={saving}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {t.saveBilling}
          </button>
          <span className={`text-sm font-semibold ${billing.requestInvoice && billingComplete ? "text-emerald-700" : "text-amber-700"}`}>
            {billing.requestInvoice
              ? billingComplete || hasBilling
                ? t.billingComplete
                : t.billingPending
              : t.billingNotRequested}
          </span>
          <button
            type="button"
            onClick={requestInvoice}
            disabled={requestingInvoice || !billing.requestInvoice || !billingComplete}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {requestingInvoice ? t.requesting : t.requestInvoice}
          </button>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-slate-900">{t.invoiceHistoryTitle}</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {invoiceEvents.length === 0 ? (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              {t.invoiceHistoryEmpty}
            </li>
          ) : (
            invoiceEvents.map((entry, i) => (
              <li
                key={`invoice-${i}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="font-semibold">{entry.date}</span> · {entry.text}
              </li>
            ))
          )}
        </ul>
      </section>

      {notice && (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {notice}
        </p>
      )}
    </>
  );
}

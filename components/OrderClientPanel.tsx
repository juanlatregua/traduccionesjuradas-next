"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type DeliveryType = "pdf" | "envio";

type OrderClientPanelProps = {
  reference: string;
  deliveryType: DeliveryType;
  shippingDataCompleted: boolean;
  shippingSummary?: string;
  invoiceRequested: boolean;
  invoiceDataCompleted: boolean;
  invoiceHistory: Array<{ date: string; text: string }>;
  paymentUrl: string;
  bizumUrl: string;
  paypalUrl: string;
  bankTransferUrl: string;
};

type ShippingForm = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

type BillingForm = {
  requestInvoice: boolean;
  legalName: string;
  taxId: string;
  billingAddress: string;
  billingCity: string;
  billingPostalCode: string;
  billingCountry: string;
  billingEmail: string;
};

const EMPTY_SHIPPING: ShippingForm = {
  fullName: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  country: "España",
};

const EMPTY_BILLING: BillingForm = {
  requestInvoice: false,
  legalName: "",
  taxId: "",
  billingAddress: "",
  billingCity: "",
  billingPostalCode: "",
  billingCountry: "España",
  billingEmail: "",
};

function isShippingComplete(data: ShippingForm) {
  return Boolean(
    data.fullName &&
      data.phone &&
      data.address &&
      data.city &&
      data.province &&
      data.postalCode &&
      data.country
  );
}

function isBillingComplete(data: BillingForm) {
  if (!data.requestInvoice) return false;
  return Boolean(
    data.legalName &&
      data.taxId &&
      data.billingAddress &&
      data.billingCity &&
      data.billingPostalCode &&
      data.billingCountry &&
      data.billingEmail
  );
}

export default function OrderClientPanel({
  reference,
  deliveryType,
  shippingDataCompleted,
  shippingSummary,
  invoiceRequested,
  invoiceDataCompleted,
  invoiceHistory,
  paymentUrl,
  bizumUrl,
  paypalUrl,
  bankTransferUrl,
}: OrderClientPanelProps) {
  const shippingKey = useMemo(() => `order-shipping-${reference}`, [reference]);
  const billingKey = useMemo(() => `order-billing-${reference}`, [reference]);
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [billing, setBilling] = useState<BillingForm>({
    ...EMPTY_BILLING,
    requestInvoice: invoiceRequested,
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedShipping = localStorage.getItem(shippingKey);
      if (savedShipping) {
        setShipping(JSON.parse(savedShipping) as ShippingForm);
      }
      const savedBilling = localStorage.getItem(billingKey);
      if (savedBilling) {
        setBilling(JSON.parse(savedBilling) as BillingForm);
      }
    } catch {
      // no-op: local storage can fail in privacy mode
    }
  }, [shippingKey, billingKey]);

  const saveShipping = () => {
    localStorage.setItem(shippingKey, JSON.stringify(shipping));
    setNotice("Datos de envio guardados.");
  };

  const saveBilling = () => {
    localStorage.setItem(billingKey, JSON.stringify(billing));
    setNotice("Datos de facturacion guardados.");
  };

  const shippingComplete = isShippingComplete(shipping);
  const billingComplete = isBillingComplete(billing);

  return (
    <>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Entrega</h2>
        <p className="mt-2 text-sm text-slate-700">
          Modalidad elegida:{" "}
          <span className="font-semibold">
            {deliveryType === "pdf" ? "PDF firmado digitalmente" : "Envio fisico"}
          </span>
        </p>
        {deliveryType === "envio" ? (
          <>
            <p className="mt-2 text-xs text-slate-600">
              Estado inicial del pedido:{" "}
              {shippingDataCompleted ? shippingSummary || "Datos de envio completados" : "Faltan datos de envio"}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={shipping.fullName}
                onChange={(e) => setShipping((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="Nombre y apellidos"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.phone}
                onChange={(e) => setShipping((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Telefono"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.address}
                onChange={(e) => setShipping((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Direccion"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={shipping.city}
                onChange={(e) => setShipping((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Ciudad"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.province}
                onChange={(e) => setShipping((prev) => ({ ...prev, province: e.target.value }))}
                placeholder="Provincia"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.postalCode}
                onChange={(e) => setShipping((prev) => ({ ...prev, postalCode: e.target.value }))}
                placeholder="Codigo postal"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.country}
                onChange={(e) => setShipping((prev) => ({ ...prev, country: e.target.value }))}
                placeholder="Pais"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveShipping}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Guardar datos de envio
              </button>
              <span className={`text-sm font-semibold ${shippingComplete ? "text-emerald-700" : "text-amber-700"}`}>
                {shippingComplete ? "Datos de envio completos" : "Pendiente completar datos de envio"}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-700">
            No se requieren datos de envio. Recibiras el documento por PDF firmado.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Pago</h2>
        <p className="mt-2 text-sm text-slate-700">
          Selecciona metodo: tarjeta, Bizum, PayPal o transferencia.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href={paymentUrl} className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">
            Tarjeta
          </Link>
          <Link href={bizumUrl} className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Bizum
          </Link>
          <Link href={paypalUrl} className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            PayPal
          </Link>
          <Link href={bankTransferUrl} className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100">
            Transferencia
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Facturacion</h2>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={billing.requestInvoice}
            onChange={(e) => setBilling((prev) => ({ ...prev, requestInvoice: e.target.checked }))}
          />
          Solicitar factura
        </label>
        {billing.requestInvoice && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={billing.legalName}
              onChange={(e) => setBilling((prev) => ({ ...prev, legalName: e.target.value }))}
              placeholder="Nombre fiscal / Empresa"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.taxId}
              onChange={(e) => setBilling((prev) => ({ ...prev, taxId: e.target.value }))}
              placeholder="NIF / CIF / VAT"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.billingAddress}
              onChange={(e) => setBilling((prev) => ({ ...prev, billingAddress: e.target.value }))}
              placeholder="Direccion fiscal"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={billing.billingCity}
              onChange={(e) => setBilling((prev) => ({ ...prev, billingCity: e.target.value }))}
              placeholder="Ciudad"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.billingPostalCode}
              onChange={(e) => setBilling((prev) => ({ ...prev, billingPostalCode: e.target.value }))}
              placeholder="Codigo postal"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.billingCountry}
              onChange={(e) => setBilling((prev) => ({ ...prev, billingCountry: e.target.value }))}
              placeholder="Pais"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.billingEmail}
              onChange={(e) => setBilling((prev) => ({ ...prev, billingEmail: e.target.value }))}
              placeholder="Email para factura"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveBilling}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Guardar datos de facturacion
          </button>
          <span className={`text-sm font-semibold ${billing.requestInvoice && billingComplete ? "text-emerald-700" : "text-amber-700"}`}>
            {billing.requestInvoice
              ? billingComplete || invoiceDataCompleted
                ? "Datos de facturacion completos"
                : "Pendiente completar datos de facturacion"
              : "Factura no solicitada"}
          </span>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-slate-900">Historial de facturas</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {invoiceHistory.length === 0 ? (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              Sin movimientos de facturacion.
            </li>
          ) : (
            invoiceHistory.map((entry) => (
              <li
                key={`invoice-${entry.date}-${entry.text}`}
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

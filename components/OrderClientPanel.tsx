"use client";

import { useState } from "react";
import Link from "next/link";

type OrderClientPanelProps = {
  reference: string;
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
  deliveryType,
  paymentStatus,
  hasShipping,
  hasBilling,
  billingRequested,
  invoiceEvents,
  initialShipping,
  initialBilling,
}: OrderClientPanelProps) {
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
        setNotice("Datos de envío guardados correctamente.");
      } else {
        setNotice(data.error || "Error al guardar datos de envío.");
      }
    } catch {
      setNotice("Error de conexión al guardar datos de envío.");
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
        setNotice("Datos de facturación guardados correctamente.");
      } else {
        setNotice(data.error || "Error al guardar datos de facturación.");
      }
    } catch {
      setNotice("Error de conexión al guardar datos de facturación.");
    } finally {
      setSaving(false);
    }
  }

  async function requestInvoice() {
    if (!billing.requestInvoice) {
      setNotice("Marca la opción de solicitar factura.");
      return;
    }
    if (!billingComplete) {
      setNotice("Completa todos los datos fiscales antes de solicitar la factura.");
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
        setNotice("Solicitud de factura enviada correctamente.");
      } else {
        setNotice(data.error || "No se pudo solicitar la factura.");
      }
    } catch {
      setNotice("Error de conexión al solicitar factura.");
    } finally {
      setRequestingInvoice(false);
    }
  }

  const isPaid = paymentStatus === "PAID";

  return (
    <>
      {/* Shipping */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Entrega</h2>
        <p className="mt-2 text-sm text-slate-700">
          Modalidad elegida:{" "}
          <span className="font-semibold">
            {deliveryType === "envio" ? "Envío físico" : "PDF firmado digitalmente"}
          </span>
        </p>
        {deliveryType === "envio" ? (
          <>
            <p className="mt-2 text-xs text-slate-600">
              {hasShipping ? "Datos de envío registrados" : "Faltan datos de envío"}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={shipping.name}
                onChange={(e) => setShipping((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nombre y apellidos"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.phone}
                onChange={(e) => setShipping((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Teléfono"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.address}
                onChange={(e) => setShipping((p) => ({ ...p, address: e.target.value }))}
                placeholder="Dirección"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={shipping.city}
                onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))}
                placeholder="Ciudad"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.province}
                onChange={(e) => setShipping((p) => ({ ...p, province: e.target.value }))}
                placeholder="Provincia"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.postalCode}
                onChange={(e) => setShipping((p) => ({ ...p, postalCode: e.target.value }))}
                placeholder="Código postal"
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={shipping.country}
                onChange={(e) => setShipping((p) => ({ ...p, country: e.target.value }))}
                placeholder="País"
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
                Guardar datos de envío
              </button>
              <span className={`text-sm font-semibold ${shippingComplete ? "text-emerald-700" : "text-amber-700"}`}>
                {shippingComplete ? "Datos de envío completos" : "Pendiente completar datos de envío"}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-700">
            No se requieren datos de envío. Recibirás el documento por PDF firmado.
          </p>
        )}
      </section>

      {/* Payment */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Pago</h2>
        {isPaid ? (
          <p className="mt-2 text-sm font-semibold text-emerald-700">Pago completado.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              Selecciona método: tarjeta, Bizum, PayPal o transferencia.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/area-cliente/pedido/${reference}/pagar`}
                className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
              >
                Ir a pagar
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Billing */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Facturación</h2>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={billing.requestInvoice}
            onChange={(e) => setBilling((p) => ({ ...p, requestInvoice: e.target.checked }))}
          />
          Solicitar factura
        </label>
        {billing.requestInvoice && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={billing.fiscalName}
              onChange={(e) => setBilling((p) => ({ ...p, fiscalName: e.target.value }))}
              placeholder="Nombre fiscal / Empresa"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.nif}
              onChange={(e) => setBilling((p) => ({ ...p, nif: e.target.value }))}
              placeholder="NIF / CIF / VAT"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.address}
              onChange={(e) => setBilling((p) => ({ ...p, address: e.target.value }))}
              placeholder="Dirección fiscal"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={billing.city}
              onChange={(e) => setBilling((p) => ({ ...p, city: e.target.value }))}
              placeholder="Ciudad"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.postalCode}
              onChange={(e) => setBilling((p) => ({ ...p, postalCode: e.target.value }))}
              placeholder="Código postal"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.country}
              onChange={(e) => setBilling((p) => ({ ...p, country: e.target.value }))}
              placeholder="País"
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={billing.email}
              onChange={(e) => setBilling((p) => ({ ...p, email: e.target.value }))}
              placeholder="Email para factura"
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
            Guardar datos de facturación
          </button>
          <span className={`text-sm font-semibold ${billing.requestInvoice && billingComplete ? "text-emerald-700" : "text-amber-700"}`}>
            {billing.requestInvoice
              ? billingComplete || hasBilling
                ? "Datos de facturación completos"
                : "Pendiente completar datos de facturación"
              : "Factura no solicitada"}
          </span>
          <button
            type="button"
            onClick={requestInvoice}
            disabled={requestingInvoice || !billing.requestInvoice || !billingComplete}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {requestingInvoice ? "Solicitando..." : "Solicitar factura"}
          </button>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-slate-900">Historial de facturas</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {invoiceEvents.length === 0 ? (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              Sin movimientos de facturación.
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

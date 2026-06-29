import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import GuestOrderLookup from "@/components/GuestOrderLookup";
import ClientAccessForm from "@/components/ClientAccessForm";
import { getClientPortalData } from "@/lib/client-portal";
import { verifyClientToken } from "@/lib/client-token";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { decimalToNumber } from "@/lib/quotes";
import { getDeliveryStateLabel, getPaymentStateLabel } from "@/lib/client-area";
import { isStaffEmail } from "@/lib/staff-access";
import AutoRefresh from "@/components/AutoRefresh";

export const metadata: Metadata = {
  title: "Área de cliente",
  description: "Tu zona: presupuestos, pedidos, facturas y descargas.",
  robots: { index: false, follow: false },
};

function eur(cents: number) {
  return `${(cents / 100).toFixed(2)} EUR`;
}

const QUOTE_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  OPENED: "Abierto",
  ACCEPTED: "Aceptado",
  PAID: "Pagado",
  IN_PROGRESS: "En proceso",
  DELIVERED: "Entregado",
  EXPIRED: "Expirado",
};

export default async function AreaClientePage({
  searchParams,
}: {
  searchParams?: { email?: string; token?: string };
}) {
  const session = await getServerSession(authOptions);
  const tokenEmail = (searchParams?.email || "").trim().toLowerCase();
  const token = (searchParams?.token || "").trim();

  // Acceso por SESIÓN (Google) o por TOKEN firmado enviado al email del cliente.
  let clientEmail: string | null = null;
  if (session?.user?.email) clientEmail = session.user.email.trim().toLowerCase();
  else if (tokenEmail && token && verifyClientToken(tokenEmail, token)) clientEmail = tokenEmail;

  if (!clientEmail) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-encre sm:text-3xl">Tu zona de cliente</h1>
          <p className="mt-2 text-sm text-sepia">
            Recibe un enlace de acceso a tu email y entra a todos tus presupuestos, pedidos, facturas y descargas.
          </p>
          <div className="mt-5">
            <ClientAccessForm />
          </div>

          <div className="mt-8 border-t border-cream pt-6">
            <p className="text-sm text-sepia">¿Solo quieres consultar un pedido por su referencia?</p>
            <div className="mt-3">
              <GuestOrderLookup />
            </div>
          </div>

          <div className="mt-8 border-t border-cream pt-6">
            <p className="text-sm text-sepia">También puedes entrar con Google:</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <GoogleSignInButton
                callbackUrl="/area-cliente"
                label="Entrar con Google"
                className="rounded-2xl bg-encre px-4 py-2 font-semibold text-white hover:bg-encre"
              />
              <Link href="/" className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream">
                Volver al inicio
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const data = await getClientPortalData(clientEmail);
  const orders = data?.orders || [];
  const quotes = data?.quotes || [];
  const invoices = data?.invoices || [];
  const customer = data?.customer || null;
  const isStaff = isStaffEmail(clientEmail);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <AutoRefresh intervalMs={30000} idleMs={45000} />

      {/* Cabecera + ficha del cliente */}
      <section className="rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Tu zona de cliente</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl">
          {customer?.companyName || customer?.name || session?.user?.name || clientEmail}
        </h1>
        <p className="mt-1 text-sm text-sepia">{clientEmail}</p>

        {customer && (customer.nif || customer.address) && (
          <div className="mt-4 rounded-2xl border border-cream bg-parchment p-4 text-sm text-sepia">
            <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Datos fiscales</p>
            {customer.fiscalName && <p className="mt-1 font-semibold text-encre">{customer.fiscalName}</p>}
            {customer.nif && <p>NIF: {customer.nif}</p>}
            {(customer.address || customer.city) && (
              <p>{[customer.address, customer.postalCode, customer.city, customer.country].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Stat label="Presupuestos" value={quotes.length} />
          <Stat label="Pedidos" value={orders.length} />
          <Stat label="Entregados" value={orders.filter((o) => o.deliveryState === "TRADUCIDO").length} />
          <Stat label="Facturas" value={invoices.length} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/expediente?email=${encodeURIComponent(clientEmail)}${
              customer?.companyName || customer?.name
                ? `&name=${encodeURIComponent(customer.companyName || customer.name || "")}`
                : ""
            }`}
            className="rounded-2xl bg-bleu px-4 py-2 font-semibold text-white hover:bg-bleu-dark"
          >
            Subir documentos · pedido nuevo
          </Link>
          {session && (
            <a href="/api/auth/signout?callbackUrl=/" className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream">
              Cerrar sesión
            </a>
          )}
          {isStaff && (
            <Link href="/zona-traductor" className="rounded-2xl border border-bleu px-4 py-2 font-semibold text-bleu hover:bg-cream">
              Zona traductor
            </Link>
          )}
        </div>
      </section>

      {/* Pedidos (expediente conjunto) */}
      <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-encre">Mis pedidos</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-sepia">Aún no tienes pedidos.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-cream">
            <table className="w-full text-left text-sm">
              <thead className="bg-parchment text-xs uppercase tracking-wide text-graphite">
                <tr>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Importe</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Descarga</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const files = Array.isArray(o.deliveryFilesJson)
                    ? (o.deliveryFilesJson as Array<{ url?: string; filename?: string | null }>).filter((f) => f && f.url)
                    : o.translatedFileUrl
                      ? [{ url: o.translatedFileUrl, filename: o.finalFilename }]
                      : [];
                  return (
                    <tr key={o.reference} className="border-t border-cream align-top">
                      <td className="px-4 py-3">
                        <a href={buildSignedOrderUrl(o.reference, "estado")} className="font-mono text-xs font-semibold text-bleu hover:underline">
                          {o.reference}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sepia">{o.createdAt.toLocaleDateString("es-ES")}</td>
                      <td className="px-4 py-3 text-sepia">{o.title}</td>
                      <td className="px-4 py-3 text-sepia">{eur(o.amountCents)}</td>
                      <td className="px-4 py-3 text-sepia">{getPaymentStateLabel(o.paymentStatus)}</td>
                      <td className="px-4 py-3 text-sepia">
                        {getDeliveryStateLabel(o.deliveryState)}
                        {o.trackingNumber ? ` · envío ${o.trackingNumber}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {files.length === 0 ? (
                          <span className="text-xs text-graphite">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {files.map((f, i) => (
                              <a key={f.url} href={f.url as string} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-bleu hover:underline">
                                ⬇ {f.filename || (files.length > 1 ? `Traducción ${i + 1}` : "Descargar")}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Presupuestos */}
      {quotes.length > 0 && (
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">Mis presupuestos</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-cream">
            <table className="w-full text-left text-sm">
              <thead className="bg-parchment text-xs uppercase tracking-wide text-graphite">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Idiomas</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha de encargo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-cream">
                    <td className="px-4 py-3 font-mono text-xs text-sepia">{q.quoteNumber}</td>
                    <td className="px-4 py-3 text-sepia">{q.sourceLang} → {q.targetLang}</td>
                    <td className="px-4 py-3 text-sepia">{decimalToNumber(q.total).toFixed(2)} EUR</td>
                    <td className="px-4 py-3 text-sepia">{QUOTE_LABEL[q.status] || q.status}</td>
                    <td className="px-4 py-3 text-sepia">{q.createdAt.toLocaleDateString("es-ES")}</td>
                    <td className="px-4 py-3">
                      <a href={`/q/${q.publicToken}`} className="text-xs font-semibold text-bleu hover:underline">
                        {q.paidAt || q.status === "PAID"
                          ? "Ver recibo"
                          : ["DRAFT", "SENT", "OPENED", "ACCEPTED"].includes(q.status)
                            ? "Ver / pagar"
                            : "Ver"}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Facturas */}
      {invoices.length > 0 && (
        <section className="mt-6 rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-encre">Mis facturas</h2>
          <ul className="mt-3 space-y-2 text-sm text-sepia">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream bg-parchment px-4 py-2">
                <span>
                  <span className="font-semibold text-encre">{inv.number}</span>
                  {inv.issuedAt ? ` · ${inv.issuedAt.toLocaleDateString("es-ES")}` : ""}
                  {inv.concept ? ` · ${inv.concept}` : ""}
                </span>
                <span className="font-semibold text-encre">
                  {eur(inv.totalCents)} {inv.paidAt ? "· cobrada" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-graphite">¿Necesitas el PDF de una factura? Escríbenos y te lo enviamos.</p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-cream bg-parchment p-3">
      <p className="text-xs uppercase tracking-wide text-graphite">{label}</p>
      <p className="mt-1 text-lg font-bold text-encre">{value}</p>
    </div>
  );
}

import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { BRANDS } from "@/lib/invoice-brands";
import { getStaffRole } from "@/lib/staff-access";

export const metadata: Metadata = {
  title: "Zona traductor — Ajustes",
  robots: { index: false, follow: false },
};

// AJUSTES: hoy es un ESPEJO de lo que está cableado en código, no un editor.
// Existe para hacer visible el trabajo que separa esta herramienta de un
// producto instalable por otro traductor jurado: cada card dice dónde vive hoy
// el dato y qué haría falta para que fuese configurable. Ver la auditoría
// (docs/auditoria-zona-traductor-2026-07-15.html, sección "Vendibilidad").
type Card = {
  title: string;
  description: string;
  values: { label: string; value: string }[];
  sourceFile: string;
  status: "cableado" | "parcial";
};

function StatusBadge({ status }: { status: Card["status"] }) {
  const map = {
    cableado: { label: "Cableado en código", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    parcial: { label: "Parcial (env vars)", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  } as const;
  const info = map[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${info.cls}`}>{info.label}</span>
  );
}

export default async function ZonaTraductorAjustesPage() {
  const email = await authZonaTraductorOrRedirect();
  const role = getStaffRole(email);
  const brands = Object.values(BRANDS);
  const primary = brands[0];

  const cards: Card[] = [
    {
      title: "Emisor fiscal",
      description:
        "Razón social, CIF, dirección e IBAN que se imprimen en cada factura y presupuesto. Para instalar esto en otro traductor hay que sacarlo del código a la base de datos.",
      values: [
        { label: "Razón social", value: primary.emitterName },
        { label: "CIF", value: primary.cif },
        { label: "Domicilio", value: `${primary.address} · ${primary.city}` },
        { label: "IBAN", value: primary.iban },
      ],
      sourceFile: "lib/invoice-brands.ts",
      status: "cableado",
    },
    {
      title: "Marcas",
      description:
        "Cada marca imprime su logo y su domicilio, compartiendo NIF y numeración. Un traductor individual solo necesitaría una: con una sola marca, el selector debería desaparecer.",
      values: brands.map((b) => ({ label: b.label, value: `${b.city} · logo ${b.logo.kind}` })),
      sourceFile: "lib/invoice-brands.ts",
      status: "cableado",
    },
    {
      title: "Régimen fiscal",
      description:
        "Determina qué borradores de impuestos se generan. Hoy asume S.L. con gestoría e ISP intracomunitario. Un autónomo necesitaría el modelo 130 (IRPF), que se retiró del borrador.",
      values: [
        { label: "Forma jurídica", value: "S.L. (sociedad limitada)" },
        { label: "IVA", value: "General 21% · ISP art. 84 LIVA" },
        { label: "Modelos", value: "303 · 111 (130 retirado: aplica a autónomos)" },
        { label: "Presentación", value: "La gestoría presenta; la web es herramienta interna" },
      ],
      sourceFile: "lib/tax-drafts.ts",
      status: "cableado",
    },
    {
      title: "Equipo y accesos",
      description:
        "Quién entra a la zona y con qué permisos. Hoy es una lista de emails con valores por defecto en código; las variables de entorno añaden, no sustituyen. No hay noción de cuenta.",
      values: [
        { label: "Tu sesión", value: email },
        { label: "Tu rol", value: role ?? "—" },
        { label: "Puerta", value: "Google OAuth + código OTP por email" },
      ],
      sourceFile: "lib/staff-access.ts",
      status: "parcial",
    },
    {
      title: "Modo agencia",
      description:
        "Colaboradores (pujas, adjudicación, margen, retención IRPF) e intermediarios. Un traductor que trabaja solo no necesita nada de esto: debería poder apagarse y desaparecer de la interfaz.",
      values: [
        { label: "Colaboradores", value: "Activo (sin interruptor)" },
        { label: "Intermediarios", value: "Activo (sin interruptor)" },
        { label: "Margen", value: "Escalado, con excepción para francés" },
      ],
      sourceFile: "lib/collaborator-*.ts · lib/margin.ts",
      status: "cableado",
    },
    {
      title: "Numeración",
      description:
        "Serie y contador de facturas y presupuestos. Ya vive en la base de datos (no en una hoja aparte), pero la serie es única y compartida entre marcas.",
      values: [
        { label: "Serie facturas", value: "AA_NNN (año + correlativo)" },
        { label: "Serie presupuestos", value: "P·AA_NNN" },
        { label: "Contador", value: "Máximo en BD por año" },
      ],
      sourceFile: "lib/client-invoice.ts",
      status: "parcial",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">Ajustes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Lo que hoy define a esta instalación. Aún no se edita desde aquí: cada tarjeta muestra el valor real y dónde
          vive.
        </p>

        <div className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
          <p className="font-semibold text-cyan-200">Esta pantalla es el mapa del trabajo pendiente</p>
          <p className="mt-1 text-cyan-100/80">
            Para que otro traductor jurado pueda usar esta herramienta, estos datos tienen que salir del código y
            pasar a ser configuración. Mientras sigan cableados, cada instalación nueva es una copia del repositorio en
            vez de un alta.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <section
              key={card.title}
              className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">{card.title}</h2>
                <StatusBadge status={card.status} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{card.description}</p>

              <dl className="mt-3 space-y-1.5">
                {card.values.map((v) => (
                  <div key={v.label} className="flex flex-wrap gap-x-2 text-xs">
                    <dt className="shrink-0 text-slate-500">{v.label}:</dt>
                    <dd className="font-medium text-slate-200">{v.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3 border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-500">
                {card.sourceFile}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

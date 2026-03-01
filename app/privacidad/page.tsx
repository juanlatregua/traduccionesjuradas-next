import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | Traducciones Juradas",
  description:
    "Política de privacidad de traduccionesjuradas.net: responsable del tratamiento, finalidad, derechos RGPD y datos de contacto.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-sepia">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Política de privacidad
      </h1>

      <section className="mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-encre">2. Política de Privacidad</h2>

          <h3 className="mt-4 font-semibold text-encre">2.1 Responsable del tratamiento</h3>
          <p className="mt-2">
            <strong>Responsable:</strong> HBTJ Consultores Lingüísticos S.L.
            <br />
            <strong>CIF:</strong> B93712784
            <br />
            <strong>Domicilio:</strong> Calle Esperanto, 9 — 29007 Málaga (España)
            <br />
            <strong>Email:</strong>{" "}
            <a className="text-bleu underline" href="mailto:hola@traduccionesjuradas.net">
              hola@traduccionesjuradas.net
            </a>
          </p>

          <h3 className="mt-6 font-semibold text-encre">2.2 Datos personales tratados</h3>
          <p className="mt-2">
            Los datos personales que pueden recopilarse incluyen nombre, apellidos, correo
            electrónico, teléfono, datos profesionales, documentos enviados para solicitud de
            presupuesto y datos de navegación.
          </p>

          <h3 className="mt-6 font-semibold text-encre">2.3 Finalidad del tratamiento</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Atender solicitudes de información y contacto.</li>
            <li>Elaborar presupuestos y prestar servicios de traducción.</li>
            <li>Gestionar la relación contractual y administrativa.</li>
            <li>Cumplir obligaciones legales.</li>
          </ul>

          <h3 className="mt-6 font-semibold text-encre">2.4 Legitimación</h3>
          <p className="mt-2">
            La base legal para el tratamiento de los datos es el consentimiento del usuario, la
            ejecución de un contrato o la aplicación de medidas precontractuales, así como el
            cumplimiento de obligaciones legales.
          </p>

          <h3 className="mt-6 font-semibold text-encre">2.5 Conservación de los datos</h3>
          <p className="mt-2">
            Los datos se conservarán durante el tiempo necesario para cumplir la finalidad para la
            que fueron recabados y mientras existan obligaciones legales.
          </p>

          <h3 className="mt-6 font-semibold text-encre">2.6 Cesión de datos</h3>
          <p className="mt-2">
            No se cederán datos a terceros salvo obligación legal o cuando sea necesario para la
            prestación del servicio, bajo contratos de confidencialidad.
          </p>

          <h3 className="mt-6 font-semibold text-encre">2.7 Derechos del usuario</h3>
          <p className="mt-2">
            El usuario puede ejercer los derechos de acceso, rectificación, supresión, oposición,
            limitación y portabilidad enviando una solicitud al correo electrónico indicado. También
            podrá presentar una reclamación ante la Agencia Española de Protección de Datos
            (www.aepd.es).
          </p>
        </div>
      </section>
    </main>
  );
}

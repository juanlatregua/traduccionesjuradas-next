import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal | Traducciones Juradas",
  description:
    "Información legal y datos del titular del sitio web traduccionesjuradas.net: responsabilidad, condiciones de uso y datos de contacto.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/aviso-legal" },
};

export default function AvisoLegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-700">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Aviso legal
      </h1>

      <section className="mt-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">1. Aviso Legal</h2>

          <h3 className="mt-4 font-semibold text-slate-900">1.1 Información general</h3>
          <p className="mt-2">
            En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y del
            Comercio Electrónico (LSSI-CE), se informa de los siguientes datos:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Titular:</strong> HBTJ Consultores Lingüísticos S.L.
            </li>
            <li>
              <strong>CIF:</strong> B93712784
            </li>
            <li>
              <strong>Actividad:</strong> Servicios lingüísticos, traducción, traducción jurada y
              consultoría lingüística
            </li>
            <li>
              <strong>Correo electrónico:</strong>{" "}
              <a className="text-emerald-700 underline" href="mailto:hola@traduccionesjuradas.net">
                hola@traduccionesjuradas.net
              </a>
            </li>
            <li>
              <strong>Domicilio:</strong> Calle Esperanto, 9 — 29007 Málaga (España)
            </li>
          </ul>

          <h3 className="mt-6 font-semibold text-slate-900">1.2 Objeto</h3>
          <p className="mt-2">
            Este sitio web tiene como objeto facilitar información sobre los servicios ofrecidos por
            HBTJ Consultores Lingüísticos S.L., así como permitir el contacto y la solicitud de
            presupuestos.
          </p>

          <h3 className="mt-6 font-semibold text-slate-900">1.3 Condiciones de uso</h3>
          <p className="mt-2">
            El acceso y uso del sitio web atribuye la condición de usuario, implicando la aceptación
            plena del contenido del presente aviso. El usuario se compromete a hacer un uso adecuado
            y lícito del sitio web.
          </p>

          <h3 className="mt-6 font-semibold text-slate-900">1.4 Propiedad intelectual e industrial</h3>
          <p className="mt-2">
            Todos los contenidos del sitio web (textos, imágenes, diseños, logotipos, estructura,
            código fuente, etc.) son titularidad de HBTJ Consultores Lingüísticos S.L. o de terceros
            autorizados, quedando prohibida su reproducción sin autorización expresa.
          </p>

          <h3 className="mt-6 font-semibold text-slate-900">1.5 Responsabilidad</h3>
          <p className="mt-2">
            HBTJ Consultores Lingüísticos S.L. no se hace responsable del mal uso que se realice del
            sitio web ni de los daños derivados del acceso o uso de la información publicada.
          </p>
        </div>
      </section>
    </main>
  );
}

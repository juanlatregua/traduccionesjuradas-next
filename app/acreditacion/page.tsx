import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Acreditación y credenciales | Traductor jurado oficial N.º 3850",
  description:
    "Credenciales oficiales de Juan Silva Moreno, traductor-intérprete jurado de francés N.º 3850, nombrado por el Ministerio de Asuntos Exteriores de España. Empresa HBTJ Consultores Lingüísticos S.L.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/acreditacion" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Acreditaci%C3%B3n+y+credenciales&subtitle=Traductor+jurado+oficial+N.%C2%BA+3850+-+MAEC",
        width: 1200,
        height: 630,
        alt: "Acreditación y credenciales — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function AcreditacionPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaPerson id="schema-person-acreditacion" />
      <SchemaBreadcrumbs
        id="breadcrumbs-acreditacion"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Acreditación", url: "https://www.traduccionesjuradas.net/acreditacion" },
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Acreditación", href: "/acreditacion" },
        ]}
      />

      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Transparencia y confianza
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Acreditación y credenciales oficiales
        </h1>
        {/* Respuesta-arriba citable (AEO). */}
        <p className="mt-3 text-base font-medium text-encre">
          La acreditación de traductor jurado la concede el Ministerio de Asuntos Exteriores (MAEC) en España y habilita para firmar y sellar traducciones con validez oficial. Juan Silva Moreno es traductor jurado de francés acreditado por el MAEC con el nº 3850.
        </p>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          En esta página reunimos las credenciales oficiales que respaldan
          nuestro trabajo como servicio de traducción jurada. Creemos que la
          transparencia es la mejor garantía para nuestros clientes.
        </p>
      </header>

      {/* TRADUCTOR JURADO OFICIAL */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Traductor jurado oficial
        </h2>
        <p>
          El responsable del servicio es{" "}
          <strong>Juan Silva Moreno</strong>, traductor-intérprete jurado de
          francés, nombrado oficialmente por el Ministerio de Asuntos
          Exteriores, Unión Europea y Cooperación del Gobierno de España.
        </p>

        {/* Tarjeta de credenciales */}
        <div className="my-6 rounded-2xl border border-cream bg-cream/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            Credenciales oficiales
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-encre">Nombre completo</dt>
              <dd className="mt-0.5 text-sm text-sepia">Juan Silva Moreno</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Número de registro</dt>
              <dd className="mt-0.5 text-sm font-bold text-bleu">3850</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Nombrado por</dt>
              <dd className="mt-0.5 text-sm text-sepia">
                Ministerio de Asuntos Exteriores, Unión Europea y Cooperación
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Año de nombramiento</dt>
              <dd className="mt-0.5 text-sm font-bold text-bleu">2009</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Combinación lingüística</dt>
              <dd className="mt-0.5 text-sm text-sepia">Francés &harr; Español</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Formación académica</dt>
              <dd className="mt-0.5 text-sm text-sepia">
                Licenciado en Traducción e Interpretación
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-sepia">
            Puedes comprobar estos datos en el{" "}
            <a
              href="https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bleu hover:underline"
            >
              listado oficial del MAEC
            </a>
            .
          </p>
        </div>
      </section>

      {/* EMPRESA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">Empresa</h2>
        <p>
          Las traducciones juradas se gestionan a través de la empresa{" "}
          <strong>HBTJ Consultores Lingüísticos S.L.</strong>, constituida
          conforme a la legislación española e inscrita en el Registro Mercantil
          de Málaga.
        </p>

        <div className="my-6 rounded-2xl border border-cream bg-cream/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            Datos mercantiles
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-encre">Razón social</dt>
              <dd className="mt-0.5 text-sm text-sepia">
                HBTJ Consultores Lingüísticos S.L.
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">CIF</dt>
              <dd className="mt-0.5 text-sm font-bold text-bleu">B93712784</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Dirección</dt>
              <dd className="mt-0.5 text-sm text-sepia">
                Calle Esperanto, 9, 29007 Málaga
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-encre">Registro</dt>
              <dd className="mt-0.5 text-sm text-sepia">
                Registro Mercantil de Málaga
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* RED DE TRADUCTORES JURADOS */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Red de traductores jurados
        </h2>
        <p>
          Además de la traducción jurada de francés, trabajamos con una red de
          traductores jurados oficiales para cubrir otros idiomas. Cada uno de
          ellos ha sido nombrado oficialmente por el Ministerio de Asuntos
          Exteriores, Unión Europea y Cooperación, lo que garantiza la validez
          legal de sus traducciones.
        </p>
        <p>Idiomas disponibles a través de nuestra red:</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Inglés</li>
          <li>Alemán</li>
          <li>Neerlandés</li>
          <li>Italiano</li>
          <li>Portugués</li>
          <li>Catalán</li>
          <li>Sueco</li>
          <li>Noruego</li>
          <li>Rumano</li>
        </ul>
        <p>
          Puedes consultar más detalles sobre nuestro equipo en la página de{" "}
          <Link
            href="/traductores-jurados"
            className="font-semibold text-bleu hover:underline"
          >
            traductores jurados
          </Link>
          .
        </p>
      </section>

      {/* VERIFICACIÓN */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">Verificación</h2>
        <p>
          El nombramiento de un traductor jurado es un acto público que puede
          verificarse en cualquier momento. Si deseas comprobar la habilitación
          de Juan Silva Moreno (n.º 3850), puedes hacerlo directamente en el{" "}
          <a
            href="https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-bleu hover:underline"
          >
            buscador oficial del Ministerio de Asuntos Exteriores
          </a>
          .
        </p>

        <div className="my-6 rounded-2xl border border-cream bg-cream/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
            Garantías de cada traducción jurada
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-sepia">
            <li>
              Cada traducción jurada incluye el{" "}
              <strong>sello oficial y la firma</strong> del traductor jurado
              habilitado, tal como exige la normativa vigente.
            </li>
            <li>
              La traducción certifica la fidelidad del contenido respecto al
              documento original.
            </li>
            <li>
              Se entrega en formato <strong>PDF firmado digitalmente</strong> y,
              si el cliente lo necesita, también en papel con firma manuscrita.
            </li>
            <li>
              Las traducciones juradas tienen plena validez ante cualquier
              organismo oficial en España y, con apostilla si fuera necesario, en
              el extranjero.
            </li>
          </ul>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-3xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas una traducción jurada?
        </h2>
        <p className="mt-1 text-encre">
          Solicita un presupuesto instantáneo o ponte en contacto con nosotros
          para que revisemos tu documentación y te asesoremos sobre los
          siguientes pasos.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Obtener presupuesto instantáneo
          </Link>
          <Link
            href="/contacto"
            className="rounded-2xl border border-bleu px-5 py-2 text-xs font-semibold text-bleu hover:bg-bleu/5"
          >
            Contactar
          </Link>
          <a
            href={MAIL_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar documentos por email
          </a>
          <a
            href={WHATSAPP_LINK}
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar fotos por WhatsApp
          </a>
        </div>
      </section>
    </main>
  );
}

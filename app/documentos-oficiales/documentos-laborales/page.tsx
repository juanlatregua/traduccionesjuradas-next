// app/documentos-oficiales/documentos-laborales/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "Traducción jurada de documentos laborales extranjeros | Contratos, nóminas, certificados y teletrabajo",
  description:
    "Traducción jurada de contratos de trabajo, nóminas, certificados de empresa, vida laboral extranjera, despidos y paquetes completos de documentación laboral para residir o teletrabajar en España, especialmente con empresas de Marruecos y otros países extranjeros.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/documentos-laborales" },
};

export default function DocumentosLaboralesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      {/* CABECERA */}
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Documentos laborales
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traducción jurada de documentos laborales
        </h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          Realizamos <strong>traducciones juradas de contratos de trabajo, nóminas,
          certificados de empresa, documentos de Seguridad Social y otros
          documentos laborales extranjeros</strong> necesarios para extranjería, visados, procesos de
          selección, teletrabajo, movilidad internacional y trámites ante
          administraciones públicas en España.
        </p>
      </header>

      {/* CONTENIDO */}
      <section className="mt-8 space-y-10 text-sm text-slate-700">
        {/* Contratos */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Contratos de trabajo y documentación asociada
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Contratos de trabajo indefinidos o temporales.</li>
            <li>Contratos mercantiles o de prestación de servicios.</li>
            <li>Aumentos salariales, adendas y anexos contractuales.</li>
            <li>Acuerdos de confidencialidad (NDA) o no competencia.</li>
          </ul>
          <p className="mt-2">
            Estos documentos suelen pedirse para visados, procesos de selección,
            acreditación de experiencia o trámites de Seguridad Social y extranjería.
          </p>
        </div>

        {/* Nóminas */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Nóminas y justificantes de ingresos
          </h2>
          <p className="mt-2">
            Las nóminas emitidas en el extranjero deben traducirse de forma
            jurada cuando se presentan ante:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Extranjería (renovaciones, permisos de residencia, etc.).</li>
            <li>Entidades bancarias españolas.</li>
            <li>Operaciones inmobiliarias (compra/venta o alquiler).</li>
            <li>Empresas que verifican historial salarial.</li>
          </ul>
          <p className="mt-2">
            También traducimos cartas salariales, declaraciones de salario,
            bonus, comisiones y otros justificantes de ingresos.
          </p>
        </div>

        {/* Certificados de empresa */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Certificados de empresa y experiencia profesional
          </h2>
          <p className="mt-2">
            Muchos clientes necesitan acreditar la relación laboral con una
            empresa extranjera ante las autoridades españolas o ante nuevos
            empleadores.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Certificados de empleo y antigüedad.</li>
            <li>Cartas de experiencia profesional.</li>
            <li>Certificados de funciones y responsabilidades.</li>
            <li>Certificados de terminación del contrato.</li>
          </ul>
        </div>

        {/* Vida laboral extranjera */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Vida laboral extranjera y documentos de Seguridad Social
          </h2>
          <p className="mt-2">
            Traducimos documentos emitidos por organismos equivalentes a la
            Seguridad Social española en otros países:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Historial de cotizaciones y periodos trabajados.</li>
            <li>Certificados de afiliación a la Seguridad Social.</li>
            <li>Prestaciones por desempleo, incapacidad o maternidad.</li>
            <li>Documentos para jubilación o pensiones.</li>
          </ul>
        </div>

        {/* Finalización de relación laboral */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Finiquitos, despidos y documentación de finalización
          </h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Cartas de despido o rescisión del contrato.</li>
            <li>Finiquitos y liquidaciones.</li>
            <li>Acuerdos de terminación voluntaria.</li>
            <li>Documentación para reclamaciones laborales.</li>
          </ul>
          <p className="mt-2">
            Estos documentos se requieren especialmente en procesos judiciales o
            administrativos, tanto en España como en otros países.
          </p>
        </div>

        {/* Teletrabajo y paquetes completos */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Paquetes completos de documentación para teletrabajo en España
          </h2>
          <p className="mt-2">
            Cada vez más personas solicitan autorización para{" "}
            <strong>teletrabajar desde España para empresas situadas en el extranjero</strong>{" "}
            (por ejemplo, profesionales que trabajan para empresas en Marruecos u otros países
            extracomunitarios). En estos casos, las autoridades suelen exigir un
            conjunto completo de documentos, muchos de los cuales requieren
            traducción jurada.
          </p>
          <p className="mt-2">
            Puedes ampliar información específica sobre este tipo de expedientes en{" "}
            <Link
              href="/teletrabajo"
              className="font-semibold text-emerald-700 hover:underline"
            >
              traducciones juradas para teletrabajar en España
            </Link>
            .
          </p>
          <p className="mt-2">
            Algunos de los documentos que suelen formar parte de este &quot;paquete&quot; son:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              Justificantes de <strong>medios económicos</strong> (ingresos
              suficientes para vivir en España).
            </li>
            <li>
              <strong>Declaraciones de salario</strong> y certificados emitidos
              por la empresa.
            </li>
            <li>
              Las <strong>tres últimas nóminas</strong> u otros justificantes de
              cobro.
            </li>
            <li>
              <strong>Certificados del Registro Mercantil</strong> o equivalente
              en el país de origen de la empresa (<Link
                href="/documentos-oficiales/documentos-mercantiles"
                className="text-emerald-700 hover:underline"
              >
                ver documentos mercantiles
              </Link>
              ).
            </li>
            <li>
              <strong>Estatutos de la empresa</strong> y documentación básica de
              la sociedad.
            </li>
            <li>
              <strong>Autorización de la empresa para teletrabajar</strong>
              desde España.
            </li>
            <li>
              <strong>Currículum vitae</strong> y certificados de experiencia
              profesional.
            </li>
            <li>
              <strong>Certificados de nacimiento de los hijos</strong> y otros
              documentos de la unidad familiar{" "}
              (<Link
                href="/documentos-oficiales/certificados-registro-civil"
                className="text-emerald-700 hover:underline"
              >
                certificados del Registro Civil
              </Link>
              ).
            </li>
            <li>
              <strong>Certificados de antecedentes penales</strong> y otros
              documentos personales exigidos por extranjería{" "}
              (<Link
                href="/documentos-oficiales/antecedentes-penales"
                className="text-emerald-700 hover:underline"
              >
                ver antecedentes penales
              </Link>
              ).
            </li>
            <li>
              Formularios y modelos oficiales (por ejemplo, impresos de
              consulado o formularios tipo EM-30 u otros modelos específicos).
            </li>
          </ul>
          <p className="mt-2">
            En estos casos, podemos ayudarte a traducir de forma jurada todo el
            conjunto de documentación para que tu expediente esté completo y
            listo para presentar.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6 text-sm">
        <h2 className="text-lg font-semibold text-emerald-900">
          ¿Necesitas traducir documentación laboral o un paquete completo para teletrabajo?
        </h2>
        <p className="mt-1 text-slate-800">
          Puedes enviarnos tu contrato, nóminas, certificados de empresa o todo
          el paquete de documentos que te ha solicitado extranjería (medios
          económicos, certificados mercantiles, antecedentes penales, estatutos,
          etc.) y te prepararemos un presupuesto ajustado. Si quieres ver el flujo completo de trabajo, puedes consultar{" "}
          <Link
            href="/proceso"
            className="font-semibold text-emerald-800 hover:underline"
          >
            cómo funciona nuestro proceso
          </Link>
          .
        </p>

        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Presupuesto%20documentos%20laborales%20y%20teletrabajo"
            className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            Enviar documentación por email
          </a>
        </div>
      </section>
    </main>
  );
}

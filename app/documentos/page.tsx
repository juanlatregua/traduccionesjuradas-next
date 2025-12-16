import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentos que traducimos | Traducción jurada oficial",
  description:
    "Listado de documentos que traducimos de forma jurada: certificados del Registro Civil, documentos de identidad, títulos académicos, contratos, escrituras, documentos mercantiles, sentencias y apostillas de la Haya.",
};

export default function DocumentosPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Documentos que traducimos
      </h1>

      <p className="mt-2 text-sm text-slate-600">
        Trabajamos con la mayoría de documentos personales, académicos y
        profesionales que requieren traducción jurada para presentarse ante
        organismos oficiales.
      </p>

      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Certificados del Registro Civil (nacimiento, matrimonio, defunción…)
        </li>
        <li>Documentos de identidad, pasaportes, libros de familia.</li>
        <li>Títulos, expedientes y certificados académicos.</li>
        <li>
          Contratos de trabajo, alquiler, compraventa y escrituras notariales.
        </li>
        <li>Documentación mercantil y financiera de empresas.</li>
        <li>Sentencias judiciales, autos, poderes y testamentos.</li>
        <li>Apostillas de la Haya y otras legalizaciones.</li>
      </ul>
    </main>
  );
}

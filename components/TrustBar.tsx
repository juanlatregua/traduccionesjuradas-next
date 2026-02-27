import Link from "next/link";
import { EMAIL, WHATSAPP_DISPLAY } from "@/lib/contact";

export function TrustBar() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer font-medium">
          Traductor jurado acreditado por el Ministerio de Asuntos Exteriores,
          Unión Europea y Cooperación · HBTJ Consultores Lingüísticos S.L. ·
          Málaga
        </summary>
        <div className="mt-3 space-y-1 text-xs text-slate-600">
          <p>HBTJ Consultores Lingüísticos S.L. · CIF B93712784</p>
          <p>Calle Esperanto, 9 · 29007 Málaga</p>
          <p>
            Email:{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-emerald-700 hover:underline"
            >
              {EMAIL}
            </a>{" "}
            · Tel:{" "}
            <a
              href="tel:+34951333614"
              className="text-emerald-700 hover:underline"
            >
              {WHATSAPP_DISPLAY}
            </a>
          </p>
          <p>
            Tratamiento de datos conforme a RGPD:{" "}
            <Link
              href="/privacidad"
              className="text-emerald-700 hover:underline"
            >
              política de privacidad
            </Link>
          </p>
        </div>
      </details>
    </section>
  );
}

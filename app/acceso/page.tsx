import type { Metadata } from "next";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export const metadata: Metadata = {
  title: "Acceso seguro",
  description: "Acceso opcional con Google para ver pedidos y seguimiento.",
  robots: {
    index: false,
    follow: false,
  },
};

type AccesoPageProps = {
  searchParams?: {
    error?: string;
  };
};

function getAuthErrorMessage(errorCode?: string) {
  if (!errorCode) return null;
  if (errorCode === "OAuthSignin" || errorCode === "OAuthCallback") {
    return "No se pudo completar el acceso con Google. Revisa la configuracion OAuth.";
  }
  if (errorCode === "Configuration") {
    return "Configuracion incompleta del acceso. Falta revisar variables de entorno.";
  }
  return "No se pudo iniciar sesion con Google. Intentalo de nuevo.";
}

export default function AccesoPage({ searchParams }: AccesoPageProps) {
  const authError = getAuthErrorMessage(searchParams?.error);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Acceso seguro
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Entra en tu area de cliente
        </h1>
        <p className="mt-3 text-sm text-slate-700">
          Puedes seguir como invitado para pagar. Si prefieres, accede con Google para centralizar
          seguimiento, datos de contacto y futuros pedidos.
        </p>
        {authError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {authError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <GoogleSignInButton
            callbackUrl="/area-cliente"
            label="Continuar con Google"
            className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          />
          <a
            href="/presupuesto"
            className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Seguir como invitado
          </a>
        </div>
      </section>
    </main>
  );
}

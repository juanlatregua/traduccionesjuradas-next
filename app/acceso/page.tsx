import type { Metadata } from "next";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { sanitizeAllowedCallbackPath } from "@/lib/auth-callback";

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
    callbackUrl?: string;
    returnTo?: string;
  };
};

function getAuthErrorMessage(errorCode?: string) {
  if (!errorCode) return null;
  if (errorCode === "StaffOnly") {
    return "Esta sección es solo para traductor/administración. Accede con un correo autorizado.";
  }
  if (errorCode === "OAuthSignin" || errorCode === "OAuthCallback") {
    return "No se pudo completar el acceso con Google. Revisa la configuración OAuth.";
  }
  if (errorCode === "Configuration") {
    return "Configuración incompleta del acceso. Falta revisar variables de entorno.";
  }
  return "No se pudo iniciar sesión con Google. Inténtalo de nuevo.";
}

export default function AccesoPage({ searchParams }: AccesoPageProps) {
  const authError = getAuthErrorMessage(searchParams?.error);
  const callbackCandidate = searchParams?.callbackUrl || searchParams?.returnTo || "";
  const callbackUrl = sanitizeAllowedCallbackPath(callbackCandidate, "/area-cliente");
  const isTranslatorAccess = callbackUrl.startsWith("/zona-traductor");
  const guestHref = callbackUrl !== "/area-cliente" ? callbackUrl : "/presupuesto";
  return (
    <main
      className={
        isTranslatorAccess
          ? "min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-12"
          : "mx-auto max-w-3xl px-4 py-12"
      }
    >
      <section
        className={
          isTranslatorAccess
            ? "mx-auto max-w-3xl rounded-3xl border border-cream/20 bg-encre/80 p-6 shadow-xl sm:p-8"
            : "rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8"
        }
      >
        <p
          className={
            isTranslatorAccess
              ? "text-xs font-semibold uppercase tracking-wide text-cyan-300"
              : "text-xs font-semibold uppercase tracking-wide text-bleu"
          }
        >
          Acceso seguro
        </p>
        <h1
          className={
            isTranslatorAccess
              ? "mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl"
              : "mt-2 text-2xl font-bold tracking-tight text-encre sm:text-3xl"
          }
        >
          {isTranslatorAccess ? "Acceso a zona traductor" : "Entra en tu área de cliente"}
        </h1>
        <p className={isTranslatorAccess ? "mt-3 text-sm text-cream" : "mt-3 text-sm text-sepia"}>
          {isTranslatorAccess
            ? "Inicia sesión con una cuenta autorizada de traductor o administración para continuar con la verificación."
            : "Puedes seguir como invitado para pagar. Si prefieres, accede con Google para centralizar seguimiento, datos de contacto y futuros pedidos."}
        </p>
        {authError && (
          <p
            className={
              isTranslatorAccess
                ? "mt-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200"
                : "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            }
          >
            {authError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            label={isTranslatorAccess ? "Entrar como traductor con Google" : "Continuar con Google"}
            className={
              isTranslatorAccess
                ? "rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-encre hover:bg-cyan-400"
                : "rounded-2xl bg-encre px-4 py-2 font-semibold text-white hover:bg-encre"
            }
          />
          {!isTranslatorAccess && (
            <a
              href={guestHref}
              className="rounded-2xl border border-cream px-4 py-2 font-semibold text-sepia hover:bg-cream"
            >
              Seguir como invitado
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

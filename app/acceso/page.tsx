import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso seguro",
  description: "Acceso opcional con Google para ver pedidos y seguimiento.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccesoPage() {
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

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <a
            href="/api/auth/signin/google?callbackUrl=/area-cliente"
            className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
            Continuar con Google
          </a>
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

import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export const metadata: Metadata = {
  title: "Area de cliente",
  description: "Acceso a tu area de cliente para seguimiento de pedidos.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AreaClientePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Acceso requerido
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Inicia sesion para ver tu area de cliente
          </h1>
          <p className="mt-3 text-sm text-slate-700">
            El pago directo sigue disponible sin login. El acceso con Google es opcional para centralizar
            seguimiento y datos de tus encargos.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <GoogleSignInButton
              callbackUrl="/area-cliente"
              label="Entrar con Google"
              className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
            />
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Area de cliente
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Bienvenido, {session.user?.name || "cliente"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sesion activa: {session.user?.email || "sin email"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href="/api/auth/signout?callbackUrl=/"
            className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cerrar sesion
          </a>
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Crear nuevo encargo
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Tus pedidos</h2>
        <p className="mt-2 text-sm text-slate-700">
          En esta primera version el acceso ya esta activo. El listado historico de pedidos y estados se
          conectara en el siguiente paso con almacenamiento persistente.
        </p>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPageAccess } from "@/lib/admin-page-access";
import { AdminNav } from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin · Colaboradores",
  robots: { index: false, follow: false },
};

export default async function AdminCollaboratorsPage() {
  await requireAdminPageAccess("/admin/collaborators");

  const collaborators = await prisma.collaborator.findMany({
    orderBy: { fullName: "asc" },
    include: {
      _count: { select: { assignments: true } },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 px-4 py-10">
      <section className="mx-auto max-w-6xl">
        <AdminNav />

        <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Colaboradores
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Directorio de colaboradores externos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {collaborators.length} colaborador{collaborators.length !== 1 ? "es" : ""} registrado{collaborators.length !== 1 ? "s" : ""}
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Idiomas</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Empresa / NIF</th>
                  <th className="px-4 py-3 font-semibold">Nº Jurado</th>
                  <th className="px-4 py-3 font-semibold">Encargos</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {collaborators.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-100">
                      {c.fullName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{c.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c.phone || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c.languages.map((l) => l.toUpperCase()).join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          c.supplierType === "EMPRESA"
                            ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                            : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                        }`}
                      >
                        {c.supplierType}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-slate-400">
                      {c.companyName || c.nif || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c.swornNumber ? `#${c.swornNumber}` : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {c._count.assignments}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          c.active
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/30 bg-red-500/10 text-red-300"
                        }`}
                      >
                        {c.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

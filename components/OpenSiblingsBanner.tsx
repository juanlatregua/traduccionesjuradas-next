import { findOpenSiblingsPorCaso, type FindOpenSiblingsOpts } from "@/lib/open-siblings-db";
import { blockingSibling, describeSibling } from "@/lib/open-siblings";

// Solo staff (Server Component). «Esta persona ya tiene abierto 2026-00219 (WhatsApp, hace 2 h) → continuar ahí».
// Lo del mismo caso no avisa: sale como una línea del hilo.
export default async function OpenSiblingsBanner(props: FindOpenSiblingsOpts & { casoId?: string | null }) {
  const { hilo, otros } = await findOpenSiblingsPorCaso(props);
  if (hilo.length === 0 && otros.length === 0) return null;
  const bloquea = !!blockingSibling(otros);
  return (
    <>
      {hilo.length > 0 && (
        <p className="mt-2 text-xs text-[#52606D]">
          Mismo caso:{" "}
          {hilo.slice(0, 4).map((s, i) => (
            <span key={`${s.kind}-${s.id}`}>
              {i > 0 ? " · " : ""}
              <a href={s.url} className="underline hover:text-[#1A2E4A]">
                {s.ref}
              </a>
            </span>
          ))}
        </p>
      )}
      {otros.length > 0 && (
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
            bloquea ? "border-[#F0C9C9] bg-[#FDF2F2] text-[#A12B2B]" : "border-[#E9D8A6] bg-[#FFF8E6] text-[#7A5A10]"
          }`}
        >
          <strong>{bloquea ? "Posible duplicado." : "Ojo."}</strong> Esta persona ya tiene abierto{props.casoId ? " en otro caso" : ""}:
          <ul className="mt-1 list-disc pl-5">
            {otros.slice(0, 4).map((s) => (
              <li key={`${s.kind}-${s.id}`}>
                {describeSibling(s)}
                {!s.samePar && s.par ? ` · otro par (${s.par})` : ""}{" "}
                <a href={s.url} className="underline hover:text-[#1A2E4A]">
                  continuar ahí →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

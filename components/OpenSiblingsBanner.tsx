import { findOpenSiblings, type FindOpenSiblingsOpts } from "@/lib/open-siblings-db";
import { blockingSibling, describeSibling } from "@/lib/open-siblings";

// Solo staff (Server Component). «Esta persona ya tiene abierto 2026-00219 (WhatsApp, hace 2 h) → continuar ahí».
export default async function OpenSiblingsBanner(props: FindOpenSiblingsOpts) {
  const sibs = await findOpenSiblings(props);
  if (sibs.length === 0) return null;
  const bloquea = !!blockingSibling(sibs);
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
        bloquea ? "border-rose-400/50 bg-rose-500/10 text-rose-100" : "border-amber-400/40 bg-amber-400/10 text-amber-100"
      }`}
    >
      <strong>{bloquea ? "Posible duplicado." : "Ojo."}</strong> Esta persona ya tiene abierto:
      <ul className="mt-1 list-disc pl-5">
        {sibs.slice(0, 4).map((s) => (
          <li key={`${s.kind}-${s.id}`}>
            {describeSibling(s)}
            {!s.samePar && s.par ? ` · otro par (${s.par})` : ""}{" "}
            <a href={s.url} className="underline hover:text-white">
              continuar ahí →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

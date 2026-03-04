import Link from "next/link";

type Crumb = { name: string; href: string };

type Props = { items: Crumb[] };

export function Breadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-graphite">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((crumb, idx) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {idx > 0 && <span aria-hidden="true">/</span>}
            {idx === items.length - 1 ? (
              <span className="text-encre font-medium">{crumb.name}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-bleu hover:underline">
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

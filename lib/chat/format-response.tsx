import { WHATSAPP_LINK } from "@/lib/contact";

type MessagePart =
  | { type: "text"; value: string }
  | { type: "whatsapp"; text: string }
  | { type: "price"; value: string }
  | { type: "phone"; number: string; display: string }
  | { type: "link"; url: string; display: string };

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
const WHATSAPP_PATTERN = /(?:WhatsApp|whatsapp|Whatsapp)(?:\s*(?:al|:))?\s*(\+?\d[\d\s]+\d)/g;
const PHONE_PATTERN = /(?<!\d)(\+34\s*\d{3}\s*\d{3}\s*\d{3})(?!\d)/g;
const PRICE_PATTERN = /(\d+(?:[.,]\d+)?\s*€(?:\s*(?:IVA incluido|\/palabra|\/página))?)/g;
const URL_PATTERN = /(https?:\/\/[^\s),]+)/g;

export function parseMessageParts(text: string): MessagePart[] {
  if (!text) return [];

  // Find all matches with their positions
  type Match = { start: number; end: number; part: MessagePart };
  const matches: Match[] = [];

  // Markdown links [text](url) — parse BEFORE other patterns so they take priority
  let m: RegExpExecArray | null;
  const mdLinkRegex = new RegExp(MARKDOWN_LINK_PATTERN.source, "g");
  while ((m = mdLinkRegex.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      part: { type: "link", url: m[2], display: m[1] },
    });
  }

  // WhatsApp mentions (skip if inside a markdown link match already)
  const waRegex = new RegExp(WHATSAPP_PATTERN.source, "g");
  while ((m = waRegex.exec(text)) !== null) {
    if (matches.some((x) => m!.index >= x.start && m!.index < x.end)) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      part: { type: "whatsapp", text: m[0] },
    });
  }

  // Prices (only if not already inside a whatsapp match)
  const priceRegex = new RegExp(PRICE_PATTERN.source, "g");
  while ((m = priceRegex.exec(text)) !== null) {
    if (!matches.some((x) => m!.index >= x.start && m!.index < x.end)) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        part: { type: "price", value: m[1] },
      });
    }
  }

  // Phone numbers (only if not inside whatsapp match)
  const phoneRegex = new RegExp(PHONE_PATTERN.source, "g");
  while ((m = phoneRegex.exec(text)) !== null) {
    if (!matches.some((x) => m!.index >= x.start && m!.index < x.end)) {
      const clean = m[1].replace(/\s/g, "");
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        part: { type: "phone", number: clean, display: m[1] },
      });
    }
  }

  // URLs
  const urlRegex = new RegExp(URL_PATTERN.source, "g");
  while ((m = urlRegex.exec(text)) !== null) {
    if (!matches.some((x) => m!.index >= x.start && m!.index < x.end)) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        part: { type: "link", url: m[1], display: m[1].replace(/^https?:\/\/(www\.)?/, "") },
      });
    }
  }

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  // Build parts array
  const parts: MessagePart[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, match.start) });
    }
    parts.push(match.part);
    cursor = match.end;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return parts;
}

export function RichMessage({ content }: { content: string }) {
  const parts = parseMessageParts(content);

  if (parts.length === 1 && parts[0].type === "text") {
    return <>{content}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return <span key={i}>{part.value}</span>;

          case "whatsapp":
            return (
              <a
                key={i}
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="my-1 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-medium text-white no-underline transition-colors hover:bg-[#20bd5a]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {part.text}
              </a>
            );

          case "price":
            return (
              <span
                key={i}
                className="inline-block rounded bg-cream/80 px-1.5 py-0.5 font-semibold text-bleu"
              >
                {part.value}
              </span>
            );

          case "phone":
            return (
              <a
                key={i}
                href={`tel:${part.number}`}
                className="font-medium text-bleu underline decoration-bleu/30 hover:decoration-bleu"
              >
                {part.display}
              </a>
            );

          case "link": {
            const isInternal = part.url.startsWith("/");
            return (
              <a
                key={i}
                href={part.url}
                target={isInternal ? undefined : "_blank"}
                rel={isInternal ? undefined : "noopener noreferrer"}
                className="font-medium text-bleu underline decoration-bleu/30 hover:decoration-bleu break-all"
              >
                {part.display}
              </a>
            );
          }
        }
      })}
    </>
  );
}

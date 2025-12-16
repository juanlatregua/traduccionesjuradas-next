// components/IconWhatsapp.tsx
import * as React from "react";

export default function IconWhatsapp(
  props: React.SVGProps<SVGSVGElement>
) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-emerald-600"
      {...props}
    >
      <path
        d="M12 2.5A9.5 9.5 0 0 0 4.1 17L3 21l4.1-1.1A9.5 9.5 0 1 0 12 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9.4 9.1c.2-.4.3-.6.6-.6h.4c.1 0 .3.1.3.3l.4 1c.1.2 0 .4 0 .4l-.3.4c-.1.1-.1.3 0 .4a5.2 5.2 0 0 0 2 2c.1.1.3.1.4 0l.4-.3s.2-.1.4 0l1 .4c.2.1.3.2.3.3v.4c0 .3-.2.5-.6.7-.3.2-.8.3-1.4.3a4.2 4.2 0 0 1-2-0.6 6.4 6.4 0 0 1-2-1.5 5.7 5.7 0 0 1-1.2-1.8c-.2-.4-.3-.9-.3-1.3 0-.4.1-.8.3-1.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

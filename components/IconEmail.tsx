// components/IconEmail.tsx
import * as React from "react";

export default function IconEmail(
  props: React.SVGProps<SVGSVGElement>
) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 text-emerald-600"
      {...props}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        ry="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <polyline
        points="4 7 12 12 20 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

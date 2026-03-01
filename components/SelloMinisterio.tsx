"use client";

import { useEffect, useRef, useState } from "react";

interface SelloMinisterioProps {
  size?: "lg" | "sm";
  className?: string;
}

export function SelloMinisterio({ size = "lg", className = "" }: SelloMinisterioProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "-50px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dim = size === "lg" ? "w-40 h-40 sm:w-48 sm:h-48" : "w-16 h-16";
  const textSize = size === "lg" ? "text-[10px] sm:text-xs" : "text-[5px]";
  const centerSize = size === "lg" ? "text-base sm:text-lg" : "text-[7px]";

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center justify-center ${dim} ${className} ${
        visible ? "animate-stampIn" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        {/* Outer circle */}
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke="#1E3A5F"
          strokeWidth="3"
          opacity="0.8"
        />
        {/* Inner circle */}
        <circle
          cx="100"
          cy="100"
          r="82"
          fill="none"
          stroke="#1E3A5F"
          strokeWidth="1.5"
          opacity="0.6"
        />
        {/* Decorative dots */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i * 10 * Math.PI) / 180;
          const x = 100 + 88 * Math.cos(angle);
          const y = 100 + 88 * Math.sin(angle);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="1"
              fill="#1E3A5F"
              opacity="0.4"
            />
          );
        })}
        {/* Top arc text */}
        <defs>
          <path
            id="topArc"
            d="M 30,100 a 70,70 0 0,1 140,0"
            fill="none"
          />
          <path
            id="bottomArc"
            d="M 170,100 a 70,70 0 0,1 -140,0"
            fill="none"
          />
        </defs>
        <text
          className={textSize}
          fill="#1E3A5F"
          fontFamily="'Libre Baskerville', Georgia, serif"
          fontWeight="700"
          letterSpacing="2"
        >
          <textPath
            href="#topArc"
            startOffset="50%"
            textAnchor="middle"
          >
            TRADUCTOR JURADO
          </textPath>
        </text>
        <text
          className={textSize}
          fill="#1E3A5F"
          fontFamily="'Libre Baskerville', Georgia, serif"
          fontWeight="400"
          letterSpacing="1.5"
        >
          <textPath
            href="#bottomArc"
            startOffset="50%"
            textAnchor="middle"
          >
            MAEC
          </textPath>
        </text>
        {/* Center number */}
        <text
          x="100"
          y="96"
          textAnchor="middle"
          className={centerSize}
          fill="#1E3A5F"
          fontFamily="'Libre Baskerville', Georgia, serif"
          fontWeight="700"
        >
          N.º
        </text>
        <text
          x="100"
          y="116"
          textAnchor="middle"
          fontSize={size === "lg" ? "22" : "10"}
          fill="#1E3A5F"
          fontFamily="'Libre Baskerville', Georgia, serif"
          fontWeight="700"
          letterSpacing="3"
        >
          3850
        </text>
        {/* Small star decorations */}
        <text x="60" y="105" textAnchor="middle" fontSize="8" fill="#B8860B" opacity="0.7">★</text>
        <text x="140" y="105" textAnchor="middle" fontSize="8" fill="#B8860B" opacity="0.7">★</text>
      </svg>
    </div>
  );
}

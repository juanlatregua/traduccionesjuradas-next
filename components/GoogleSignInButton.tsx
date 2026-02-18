"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  className?: string;
  label?: string;
};

export default function GoogleSignInButton({
  callbackUrl = "/area-cliente",
  className,
  label = "Continuar con Google",
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("No se pudo iniciar el acceso con Google.");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
      >
        {loading ? "Abriendo Google..." : label}
      </button>
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

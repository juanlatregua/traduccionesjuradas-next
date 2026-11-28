"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { COMMENT_MAX, REVIEW_STRINGS, type ReviewLang } from "@/lib/order-review";

type Props = {
  reference: string;
  token: string;
  stars: number;
  name: string;
  lang: ReviewLang;
  googleUrl: string;
};

// La nota se guarda desde el navegador (no en el GET del servidor): los
// escáneres de enlaces del correo abren las 5 estrellas sin ejecutar JS.
export default function OpinionClient({ reference, token, stars, name, lang, googleUrl }: Props) {
  const s = REVIEW_STRINGS[lang];
  const endpoint = `/api/opinion/${encodeURIComponent(reference)}`;
  const saved = useRef(false);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, r: stars }),
    }).catch(console.error);
  }, [endpoint, token, stars]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    if (!comment.trim()) {
      document.getElementById("opinion-comment")?.focus();
      return;
    }
    setState("sending");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, r: stars, comment }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-6 text-center">
      <p className="flex justify-center gap-1 text-3xl text-or" role="img" aria-label={s.starsLabel(stars)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} aria-hidden="true" className={n <= stars ? "text-or" : "text-or-light"}>
            ★
          </span>
        ))}
      </p>
      <h1 className="mt-4 font-baskerville text-2xl text-encre">{s.thanks(name)}</h1>
      <p className="mt-3 text-sepia">
        {s.saved} {s.ask}
      </p>
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 block w-full rounded-lg bg-encre px-4 py-3 text-center font-semibold text-white hover:bg-bleu-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-or focus-visible:ring-offset-2"
      >
        {s.googleButton}
      </a>
      <p className="mt-2 text-sm text-graphite">{s.googleHint}</p>

      <hr className="my-8 border-or/30" />

      {state === "sent" ? (
        <p className="text-left text-encre" role="status">
          {s.sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="text-left">
          <h2 className="font-baskerville text-lg text-encre">{s.improveTitle}</h2>
          <p className="mt-1 text-sm text-graphite">{s.improveHint}</p>
          <label htmlFor="opinion-comment" className="mt-4 block text-sm font-medium text-sepia">
            {s.commentLabel}
          </label>
          <textarea
            id="opinion-comment"
            name="comment"
            rows={4}
            maxLength={COMMENT_MAX}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-graphite/30 bg-white px-3 py-2 text-base text-sepia focus:border-encre focus:outline-none focus:ring-2 focus:ring-or"
          />
          {state === "error" && (
            <p className="mt-2 text-sm text-rouge" role="alert">
              {s.error}
            </p>
          )}
          <button
            type="submit"
            disabled={state === "sending"}
            aria-busy={state === "sending"}
            className="mt-3 w-full rounded-lg border border-encre px-4 py-3 font-semibold text-encre hover:bg-cream disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-or focus-visible:ring-offset-2"
          >
            {state === "sending" ? s.sending : s.send}
          </button>
        </form>
      )}
    </div>
  );
}

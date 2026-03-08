"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

export function TrackEvent({
  name,
  data,
}: {
  name: string;
  data?: Record<string, string | number | boolean>;
}) {
  useEffect(() => {
    track(name, data);
  }, [name, data]);

  return null;
}

const SAFE_CALLBACK_PREFIXES = [
  "/area-cliente",
  "/zona-traductor",
  "/start",
  "/upload",
  "/review",
  "/checkout",
  "/confirmation",
  "/traductor-jurado-frances",
];

function isSafeInternalPath(path: string) {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

function pathMatchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

export function isAllowedCallbackPath(path: string) {
  if (!isSafeInternalPath(path)) return false;
  return SAFE_CALLBACK_PREFIXES.some((prefix) => pathMatchesPrefix(path, prefix));
}

export function sanitizeAllowedCallbackPath(path: string | undefined | null, fallback = "/area-cliente") {
  if (!path) return fallback;
  return isAllowedCallbackPath(path) ? path : fallback;
}


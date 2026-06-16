import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CIUDADES } from "@/src/data/ciudades";

const CITY_SLUGS = new Set(CIUDADES.map((c) => c.slug));

// Old WP URLs used different slugs for some cities
const LEGACY_CITY_MAP: Record<string, string> = {
  "palma-de-mallorca": "palma",
};

function gone() {
  return new NextResponse("Gone", {
    status: 410,
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function redirectPermanent(req: NextRequest, destination: string) {
  const url = req.nextUrl.clone();
  url.pathname = destination;
  url.search = "";
  return NextResponse.redirect(url, 301);
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Block all ?action= query strings (WP legacy endpoints) → 410 Gone para que
  // Google los desindexe rápido (antes 404, que dejaba a Google reintentando).
  if (searchParams.get('action')) {
    return gone();
  }

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const pathLower = normalizedPath.toLowerCase();

  const isWpJson = pathLower === "/wp-json" || pathLower.startsWith("/wp-json/");
  const isWpAdmin = pathLower === "/wp-admin" || pathLower.startsWith("/wp-admin/");
  const isWpLogin = pathLower === "/wp-login.php";
  const isXmlRpc = pathLower === "/xmlrpc.php";
  const isWpPluginEndpoint = /^\/wp-content\/plugins\/[^/]+\/endpoint\.php$/i.test(pathLower);
  const isFeed = pathLower === "/feed" || pathLower.endsWith("/feed");
  const hasLegacyRouteQueryRoot =
    searchParams.has("route") &&
    (pathLower === "/" || pathLower === "/index.php" || pathLower.endsWith("/index.php"));
  const hasLegacyRouteQueryOther =
    searchParams.has("route") && !hasLegacyRouteQueryRoot;

  if (
    isWpJson ||
    isWpAdmin ||
    isWpLogin ||
    isXmlRpc ||
    isWpPluginEndpoint ||
    isFeed ||
    hasLegacyRouteQueryRoot
  ) {
    return gone();
  }

  // Legacy ?route= on real pages (e.g. /documentos-oficiales?route=...) → strip query params
  if (hasLegacyRouteQueryOther) {
    return redirectPermanent(req, normalizedPath);
  }

  const VALID_LEGACY_PATHS = new Set([
    "/traductor-jurado-frances",
    "/traductor-jurado-ingles",
    "/traductor-jurado-aleman",
    "/traductor-jurado-portugues",
    "/traductor-jurado-italiano",
    "/traductor-jurado-neerlandes",
    "/traductor-jurado-catalan",
    "/traductor-jurado-rumano",
    "/traductor-jurado-sueco",
    "/traductor-jurado-noruego",
    "/traduccion-jurada-online",
    "/traduccion-jurada-frances-malaga",
    "/traducciones-juradas-baratas",
    "/traductores-jurados",
    "/traduccion-jurada-permiso-de-conducir",
    "/traduccion-jurada-antecedentes-penales",
    "/traduccion-jurada-sentencia-judicial",
    "/traduccion-jurada-de-escritura-notarial",
    "/traduccion-jurada-de-estatutos-sociales",
    "/traduccion-jurada-de-certificado-de-seguridad-social",
  ]);
  const isLanguagePillar = VALID_LEGACY_PATHS.has(pathLower);
  const isFrenchPillar = pathLower === "/traductor-jurado-frances";
  const isFrenchLegacy =
    !isFrenchPillar &&
    !isLanguagePillar &&
    pathLower.includes("frances") &&
    !pathLower.startsWith("/api/") &&
    !pathLower.startsWith("/_next/");

  if (isFrenchLegacy) {
    return redirectPermanent(req, "/traductor-jurado-frances");
  }

  // /inicio, /agencia, /contacto/page/N y /categoria-producto/*
  // se gestionan en next.config.mjs (se ejecuta antes del middleware)

  // /traductor-jurado/[ciudad] y el hub /traductor-jurado son páginas reales.
  const isCityPage = pathLower.startsWith("/traductor-jurado/");
  const isCityHub = pathLower === "/traductor-jurado";

  // Redirect old WP city URLs: /traductor-jurado-madrid → /traductor-jurado/madrid
  if (pathLower.startsWith("/traductor-jurado-") && !isLanguagePillar) {
    const suffix = pathLower.replace(/^\/traductor-jurado-/, "");
    const mappedSlug = LEGACY_CITY_MAP[suffix] || suffix;
    if (CITY_SLUGS.has(mappedSlug)) {
      return redirectPermanent(req, `/traductor-jurado/${mappedSlug}`);
    }
  }

  const startsWithLegacySlug =
    pathLower.startsWith("/traductor-jurado-") ||
    pathLower.startsWith("/traduccion-jurada-") ||
    pathLower.startsWith("/traductor-") ||
    pathLower.startsWith("/traducciones-");

  if (startsWithLegacySlug && !isLanguagePillar && !isCityPage && !isCityHub) {
    return redirectPermanent(req, "/");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

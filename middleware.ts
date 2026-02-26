import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const pathLower = normalizedPath.toLowerCase();

  const isWpJson = pathLower === "/wp-json" || pathLower.startsWith("/wp-json/");
  const isWpAdmin = pathLower === "/wp-admin" || pathLower.startsWith("/wp-admin/");
  const isWpLogin = pathLower === "/wp-login.php";
  const isXmlRpc = pathLower === "/xmlrpc.php";
  const isWpPluginEndpoint = /^\/wp-content\/plugins\/[^/]+\/endpoint\.php$/i.test(pathLower);
  const isFeed = pathLower === "/feed" || pathLower.endsWith("/feed");
  const hasLegacyRouteQuery =
    searchParams.has("route") &&
    (pathLower === "/" || pathLower === "/index.php" || pathLower.endsWith("/index.php"));

  if (
    isWpJson ||
    isWpAdmin ||
    isWpLogin ||
    isXmlRpc ||
    isWpPluginEndpoint ||
    isFeed ||
    hasLegacyRouteQuery
  ) {
    return gone();
  }

  const LANGUAGE_PILLARS = new Set([
    "/traductor-jurado-frances",
    "/traductor-jurado-ingles",
    "/traductor-jurado-aleman",
    "/traductor-jurado-portugues",
    "/traductor-jurado-italiano",
    "/traductor-jurado-neerlandes",
    "/traductor-jurado-catalan",
    "/traductor-jurado-sueco",
    "/traductor-jurado-noruego",
  ]);
  const isLanguagePillar = LANGUAGE_PILLARS.has(pathLower);
  const isFrenchPillar = pathLower === "/traductor-jurado-frances";
  const isFrenchLegacy =
    !isFrenchPillar &&
    pathLower.includes("frances") &&
    !pathLower.startsWith("/api/") &&
    !pathLower.startsWith("/_next/");

  if (isFrenchLegacy) {
    return redirectPermanent(req, "/traductor-jurado-frances");
  }

  if (
    pathLower === "/inicio" ||
    pathLower.startsWith("/inicio/") ||
    pathLower === "/agencia" ||
    pathLower.startsWith("/agencia/")
  ) {
    return redirectPermanent(req, "/");
  }

  const isLegacyContactPage = /^\/contacto\/page\/\d+$/i.test(pathLower);
  if (isLegacyContactPage) {
    return redirectPermanent(req, "/contacto");
  }

  const startsWithLegacySlug =
    pathLower.startsWith("/traductor-jurado-") ||
    pathLower.startsWith("/traduccion-jurada-") ||
    pathLower.startsWith("/traductor-") ||
    pathLower.startsWith("/traducciones-") ||
    pathLower.startsWith("/categoria-producto/");

  if (startsWithLegacySlug && !isLanguagePillar) {
    return redirectPermanent(req, "/");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

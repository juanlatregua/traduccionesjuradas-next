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

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  const isWpJson = normalizedPath === "/wp-json" || normalizedPath.startsWith("/wp-json/");
  const isWpAdmin = normalizedPath === "/wp-admin" || normalizedPath.startsWith("/wp-admin/");
  const isWpLogin = normalizedPath === "/wp-login.php";
  const isXmlRpc = normalizedPath === "/xmlrpc.php";
  const isWpPluginEndpoint = /^\/wp-content\/plugins\/[^/]+\/endpoint\.php$/i.test(normalizedPath);
  const isFeed = normalizedPath === "/feed" || normalizedPath.endsWith("/feed");
  const hasLegacyRouteQuery =
    searchParams.has("route") && (normalizedPath === "/index.php" || normalizedPath === "/");

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

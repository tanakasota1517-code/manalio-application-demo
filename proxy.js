import { NextResponse } from "next/server";

const privatePagePaths = new Set(["/login", "/app"]);
const publicDemoBlockedPrefixes = ["/workspace", "/api/workspace"];
const PUBLIC_DEMO_ONLY = process.env.MANABI_PUBLIC_DEMO_ONLY === "true";

export function proxy(request) {
  const headers = {};
  const isPrivatePage = privatePagePaths.has(request.nextUrl.pathname);
  const isPublicDemoBlockedPath = publicDemoBlockedPrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (isPrivatePage) {
    headers["Cache-Control"] = "no-store, no-cache, max-age=0, must-revalidate";
    headers.Pragma = "no-cache";
    headers.Expires = "0";
  }

  if (PUBLIC_DEMO_ONLY && (isPrivatePage || isPublicDemoBlockedPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/demo";
    url.search = "";
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    response.headers.set("Pragma", headers.Pragma);
    response.headers.set("Expires", headers.Expires);
    return response;
  }

  const response = NextResponse.next({ headers });

  if (isPrivatePage) {
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    response.headers.set("Pragma", headers.Pragma);
    response.headers.set("Expires", headers.Expires);
  }

  return response;
}

export const config = {
  matcher: ["/login", "/app", "/workspace/:path*", "/api/workspace/:path*"],
};

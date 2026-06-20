import { NextResponse } from "next/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};
const privatePagePrefixes = ["/login", "/app"];
const publicDemoBlockedPrefixes = ["/workspace"];
const publicDemoRedirectPagePrefixes = [
  "/",
  "/product",
  "/governance",
  "/evidence",
  "/pilot",
  "/terms",
  "/privacy",
  "/commercial-transactions",
];
const publicDemoRedirectStaticPaths = ["/offline.html", "/sw.js"];
const publicDemoBlockedApiPrefixes = [
  "/api/health",
  "/api/workspace",
  "/api/auth",
  "/api/generate",
  "/api/privacy-check",
  "/api/school",
  "/api/logs",
  "/api/demo/access",
];
const publicDemoAllowedPaths = ["/demo", "/demo/student", "/demo/teacher"];

export function proxy(request) {
  const headers = {};
  const isPrivatePage = privatePagePrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  const isPublicDemoBlockedPath = publicDemoBlockedPrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  const isPublicDemoRedirectPagePath = publicDemoRedirectPagePrefixes.some((prefix) => {
    if (prefix === "/") return request.nextUrl.pathname === "/";
    return request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`);
  });
  const isPublicDemoRedirectStaticPath = publicDemoRedirectStaticPaths.includes(request.nextUrl.pathname);
  const isPublicDemoBlockedApiPath = publicDemoBlockedApiPrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  const isPublicDemoAllowedPath = publicDemoAllowedPaths.includes(request.nextUrl.pathname);
  if (isPrivatePage) {
    Object.assign(headers, NO_STORE_HEADERS);
  }

  if (isPublicDemoOnly() && !isPublicDemoAllowedPath && (isPrivatePage || isPublicDemoBlockedPath || isPublicDemoRedirectPagePath || isPublicDemoRedirectStaticPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/demo";
    url.search = "";
    const response = NextResponse.redirect(url, 307);
    for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
      response.headers.set(name, value);
    }
    return response;
  }

  if (isPublicDemoOnly() && isPublicDemoBlockedApiPath) {
    return NextResponse.json(
      { code: "public_demo_api_disabled", error: "公開デモでは、このAPIを使用しません。" },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const response = NextResponse.next({ headers });

  if (isPrivatePage) {
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    response.headers.set("Pragma", headers.Pragma);
    response.headers.set("Expires", headers.Expires);
  }

  return response;
}

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}

export const config = {
  matcher: [
    "/login",
    "/login/:path*",
    "/app",
    "/app/:path*",
    "/",
    "/product",
    "/product/:path*",
    "/governance",
    "/governance/:path*",
    "/evidence",
    "/evidence/:path*",
    "/pilot",
    "/pilot/:path*",
    "/terms",
    "/terms/:path*",
    "/privacy",
    "/privacy/:path*",
    "/commercial-transactions",
    "/commercial-transactions/:path*",
    "/offline.html",
    "/sw.js",
    "/workspace",
    "/workspace/:path*",
    "/api/health",
    "/api/health/:path*",
    "/api/workspace",
    "/api/workspace/:path*",
    "/api/auth",
    "/api/auth/:path*",
    "/api/generate",
    "/api/generate/:path*",
    "/api/privacy-check",
    "/api/privacy-check/:path*",
    "/api/school",
    "/api/school/:path*",
    "/api/logs",
    "/api/logs/:path*",
    "/api/demo/access",
    "/api/demo/access/:path*",
  ],
};

import { absoluteUrl, SITE_URL } from "./site-config";

export default function robots() {
  if (isPublicDemoOnly()) {
    return {
      rules: {
        userAgent: "*",
        allow: ["/demo", "/demo/student", "/demo/teacher"],
        disallow: "/",
      },
      sitemap: absoluteUrl("/sitemap.xml"),
      host: SITE_URL,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app", "/login", "/demo", "/workspace"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}

import { absoluteUrl } from "./site-config";

const lastModified = new Date("2026-05-10T00:00:00.000Z");

export default function sitemap() {
  if (isPublicDemoOnly()) {
    return ["/demo", "/demo/student", "/demo/teacher"].map((path) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: "weekly",
      priority: path === "/demo" ? 1 : 0.7,
    }));
  }

  return [
    "",
    "/product",
    "/governance",
    "/evidence",
    "/pilot",
    "/terms",
    "/privacy",
    "/commercial-transactions",
  ].map((path) => ({
    url: absoluteUrl(path || "/"),
    lastModified,
    changeFrequency: path ? "monthly" : "weekly",
    priority: path ? 0.7 : 1,
  }));
}

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}

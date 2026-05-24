import { absoluteUrl } from "./site-config";

const lastModified = new Date("2026-05-10T00:00:00.000Z");

export default function sitemap() {
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

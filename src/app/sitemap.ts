import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/play", "/play/standings", "/about", "/privacy", "/terms"].map(
    (pathname) => ({ url: new URL(pathname, "https://badmintonxp.com").href }),
  );
}

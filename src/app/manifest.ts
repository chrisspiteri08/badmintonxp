import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/play",
    name: "BadmintonXP",
    short_name: "BadmintonXP",
    start_url: "/play",
    scope: "/play",
    display: "standalone",
    theme_color: "#06152c",
    background_color: "#06152c",
    icons: [
      {
        src: "/icons/badmintonxp-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/badmintonxp-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/badmintonxp-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

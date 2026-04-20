import type { MetadataRoute } from "next";

type ShareTarget = {
  action: string;
  method: "GET" | "POST";
  // Per W3C Web Share Target spec, enctype is only meaningful for POST,
  // but Chrome's manifest validator warns on any method when omitted.
  // Keep it optional to reflect the spec, and set it explicitly where needed.
  enctype?: "application/x-www-form-urlencoded" | "multipart/form-data";
  params: Record<string, string>;
};

type ManifestWithShareTarget = MetadataRoute.Manifest & {
  share_target: ShareTarget;
};

export default function manifest(): ManifestWithShareTarget {
  return {
    name: "sugara",
    short_name: "sugara",
    description: "A collaborative app for creating and sharing travel plans.",
    start_url: "/home",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    share_target: {
      action: "/share-target",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        url: "url",
        title: "title",
        text: "text",
      },
    },
  };
}

import type { MetadataRoute } from "next";

type ShareTarget = {
  action: string;
  method: string;
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
      params: {
        url: "url",
        title: "title",
        text: "text",
      },
    },
  };
}

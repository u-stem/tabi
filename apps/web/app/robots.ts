import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.BETTER_AUTH_BASE_URL ?? "https://sugara.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/news/", "/faq", "/terms", "/privacy"],
        disallow: [
          "/home",
          "/trips/",
          "/bookmarks/",
          "/settings",
          "/my/",
          "/friends/",
          "/polls/",
          "/tools/",
          "/admin/",
          "/sp/",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

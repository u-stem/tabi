import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { headers } from "next/headers";
import { QueryProvider } from "@/components/query-provider";
import { SwProvider } from "@/components/sw-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getSeason } from "@/lib/season";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  preload: false,
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export function generateMetadata(): Metadata {
  const season = getSeason();
  const description = "旅行の計画を作成・共有できる共同編集アプリ。";
  const ogImage = `/icons/apple-touch-icon-${season}.png`;
  return {
    metadataBase: new URL(process.env.BETTER_AUTH_BASE_URL ?? "https://sugara.vercel.app"),
    title: "sugara",
    description,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: `/icons/favicon-${season}.png`,
      apple: ogImage,
    },
    openGraph: {
      title: "sugara",
      description,
      images: [ogImage],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "sugara",
      description,
      images: [ogImage],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${notoSansJP.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <SwProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"}>
            <QueryProvider>{children}</QueryProvider>
          </SwProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

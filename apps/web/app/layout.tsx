import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const season = getSeason();
  const description = t("description");
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
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} translate="no" suppressHydrationWarning>
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
            <NextIntlClientProvider messages={messages}>
              <QueryProvider>{children}</QueryProvider>
            </NextIntlClientProvider>
          </SwProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

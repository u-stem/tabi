import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
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
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateMetadata(): Metadata {
  const season = getSeason();
  return {
    title: "sugara",
    description: "旅行の計画を作成・共有できる共同編集アプリ。",
    icons: {
      icon: `/icons/favicon-${season}.png`,
      apple: `/icons/apple-touch-icon-${season}.png`,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        >
          <SwProvider swUrl="/serwist/sw.js">
            <QueryProvider>{children}</QueryProvider>
          </SwProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

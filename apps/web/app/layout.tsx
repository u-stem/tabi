import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tabi - Travel Planner",
  description: "Plan your perfect trip",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

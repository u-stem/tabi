import { getFaqs } from "@sugara/api/lib/faqs";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { pageTitle } from "@/lib/constants";
import { FaqSearch } from "./_components/faq-search";

export const metadata: Metadata = {
  title: pageTitle("よくある質問"),
};

export default async function FaqPage() {
  const faqs = await getFaqs();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">よくある質問</h1>
        <FaqSearch faqs={faqs} />
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          お知らせ
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}

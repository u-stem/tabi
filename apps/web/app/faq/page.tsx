import { getFaqs } from "@sugara/api/lib/faqs";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { pageTitle } from "@/lib/constants";
import { FaqSearch } from "./_components/faq-search";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageTitle");
  return { title: pageTitle(t("faq")) };
}

export default async function FaqPage() {
  const locale = await getLocale();
  const faqs = await getFaqs(locale);
  const t = await getTranslations("faq");
  const tl = await getTranslations("legal");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <FaqSearch faqs={faqs} />
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          {tl("footer.news")}
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          {tl("footer.terms")}
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          {tl("footer.privacy")}
        </Link>
      </footer>
    </div>
  );
}

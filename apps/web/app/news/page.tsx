import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { pageTitle } from "@/lib/constants";
import { getAllNews } from "@/lib/news";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageTitle");
  return { title: pageTitle(t("news")) };
}

export default async function NewsPage() {
  const articles = getAllNews();
  const t = await getTranslations("news");
  const tl = await getTranslations("legal");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>

        {articles.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-8 space-y-6">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link href={`/news/${article.slug}`} className="group block">
                  <time className="text-sm text-muted-foreground">{article.date}</time>
                  <h2 className="mt-1 text-lg font-semibold group-hover:underline">
                    {article.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          {tl("footer.faq")}
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

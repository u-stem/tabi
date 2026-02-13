import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { Logo } from "@/components/logo";
import { getAllNews, getNewsBySlug } from "@/lib/news";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const articles = await getAllNews();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);
  if (!article) return { title: "お知らせ - sugara" };
  return { title: `${article.title} - sugara` };
}

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>

      <main className="container max-w-3xl flex-1 px-4 py-8">
        <Link
          href="/news"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          お知らせ一覧
        </Link>

        <article className="mt-6">
          <time className="text-sm text-muted-foreground">{article.date}</time>
          <h1 className="mt-1 text-2xl font-bold">{article.title}</h1>

          <div className="news-content mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:space-y-1">
            <Markdown>{article.content}</Markdown>
          </div>
        </article>
      </main>

      <footer className="container flex h-14 items-center justify-center gap-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          よくある質問
        </Link>
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

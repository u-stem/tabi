import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

type NewsMeta = {
  title: string;
  date: string;
  summary: string;
  slug: string;
};

type NewsArticle = NewsMeta & {
  content: string;
};

const DEFAULT_LOCALE = "ja";
const newsDir = path.join(process.cwd(), "content", "news");

function localeDir(locale: string): string {
  return path.join(newsDir, locale);
}

function parseFile(filePath: string, slug: string): NewsMeta & { content: string } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    title: data.title as string,
    date: data.date as string,
    summary: data.summary as string,
    slug,
    content,
  };
}

export function getAllNews(locale: string = DEFAULT_LOCALE): NewsMeta[] {
  const jaDir = localeDir(DEFAULT_LOCALE);
  const targetDir = localeDir(locale);

  // Start with all ja slugs as the canonical set
  const jaSlugs = fs
    .readdirSync(jaDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));

  const articles = jaSlugs.map((slug) => {
    const targetPath = path.join(targetDir, `${slug}.md`);
    const jaPath = path.join(jaDir, `${slug}.md`);

    // Use target locale if available, fall back to ja
    const filePath = locale !== DEFAULT_LOCALE && fs.existsSync(targetPath) ? targetPath : jaPath;
    const { content: _, ...meta } = parseFile(filePath, slug);
    return meta;
  });

  return articles.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export function getNewsBySlug(slug: string, locale: string = DEFAULT_LOCALE): NewsArticle | null {
  if (slug.includes("..") || slug.includes("/")) return null;

  const targetPath = path.join(localeDir(locale), `${slug}.md`);
  const jaPath = path.join(localeDir(DEFAULT_LOCALE), `${slug}.md`);

  // Use target locale if available, fall back to ja
  const filePath = locale !== DEFAULT_LOCALE && fs.existsSync(targetPath) ? targetPath : jaPath;

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return parseFile(filePath, slug);
}

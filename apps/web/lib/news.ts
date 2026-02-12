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

const newsDir = path.join(process.cwd(), "content", "news");

export async function getAllNews(): Promise<NewsMeta[]> {
  const files = fs.readdirSync(newsDir).filter((f) => f.endsWith(".md"));

  const articles = files.map((file) => {
    const raw = fs.readFileSync(path.join(newsDir, file), "utf-8");
    const { data } = matter(raw);
    return {
      title: data.title as string,
      date: data.date as string,
      summary: data.summary as string,
      slug: file.replace(/\.md$/, ""),
    };
  });

  return articles.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

export async function getNewsBySlug(slug: string): Promise<NewsArticle | null> {
  const filePath = path.join(newsDir, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

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

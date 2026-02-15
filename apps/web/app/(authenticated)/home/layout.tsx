import Link from "next/link";
import { getAllNews } from "@/lib/news";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const articles = await getAllNews();
  const latest = articles[0];

  return (
    <>
      {latest && (
        <Link
          href={`/news/${latest.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm transition-colors hover:bg-muted"
        >
          <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
            NEW
          </span>
          <span className="truncate">{latest.title}</span>
          <time className="ml-auto shrink-0 text-xs text-muted-foreground">{latest.date}</time>
        </Link>
      )}
      {children}
    </>
  );
}

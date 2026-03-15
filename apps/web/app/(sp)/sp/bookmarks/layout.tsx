import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("ブックマーク") };

export default function SpBookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}

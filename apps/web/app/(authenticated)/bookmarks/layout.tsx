import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("ブックマーク") };

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}

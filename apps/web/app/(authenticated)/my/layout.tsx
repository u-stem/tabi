import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("プロフィール") };

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

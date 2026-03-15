import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("ルーレット") };

export default function RouletteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

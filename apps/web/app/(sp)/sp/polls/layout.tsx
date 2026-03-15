import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("かんたん投票") };

export default function SpPollsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

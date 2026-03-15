import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("フレンド") };

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

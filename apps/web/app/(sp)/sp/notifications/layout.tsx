import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("通知") };

export default function SpNotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

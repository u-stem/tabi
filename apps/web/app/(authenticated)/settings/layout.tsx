import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("設定") };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

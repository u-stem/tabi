import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("設定") };

export default function SpSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

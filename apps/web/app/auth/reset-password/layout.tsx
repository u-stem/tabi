import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("パスワードを再設定") };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

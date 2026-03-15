import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("パスワードをリセット") };

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

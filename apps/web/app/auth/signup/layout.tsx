import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("新規登録") };

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

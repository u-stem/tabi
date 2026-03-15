import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = { title: pageTitle("ログイン") };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

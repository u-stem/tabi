import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pageTitle");
  return { title: pageTitle(t("forgotPassword")) };
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

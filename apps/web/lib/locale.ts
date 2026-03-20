"use server";

import { cookies } from "next/headers";

export async function setLocale(locale: string) {
  (await cookies()).set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
    sameSite: "lax",
  });
}

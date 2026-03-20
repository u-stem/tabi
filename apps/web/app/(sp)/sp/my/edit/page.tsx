"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ProfileSection } from "@/app/(authenticated)/settings/page";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";

export default function SpMyEditPage() {
  const tp = useTranslations("profile");
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    document.title = pageTitle(tp("editPageTitle"));
  }, [tp]);

  const user = session?.user;

  return (
    <div className="mt-4 mx-auto max-w-2xl">
      {user && (
        <ProfileSection
          name={user.name ?? ""}
          currentImage={user.image ?? null}
          onSuccess={() => router.push("/sp/my")}
          noCard
        />
      )}
    </div>
  );
}

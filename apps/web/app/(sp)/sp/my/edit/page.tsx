"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileSection } from "@/app/(authenticated)/settings/page";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";

export default function SpMyEditPage() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    document.title = pageTitle("プロフィールを編集");
  }, []);

  const user = session?.user;

  return (
    <div className="mt-4 mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/sp/my"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
          aria-label="戻る"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold">プロフィールを編集</h1>
      </div>

      {user && (
        <ProfileSection
          name={user.name ?? ""}
          currentImage={user.image ?? null}
          onSuccess={() => router.push("/sp/my")}
        />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";

// Fallback for native camera QR scan — redirect to friends page with addUserId param
export default async function SpFriendsAddRedirect({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;
  if (userId) {
    redirect(`/sp/friends?addUserId=${encodeURIComponent(userId)}`);
  }
  redirect("/sp/friends");
}

import type { SharedPollResponse } from "@sugara/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageTitle } from "@/lib/constants";
import { formatDateFromISO } from "@/lib/format";
import { getSeason } from "@/lib/season";
import { SharedPollClient } from "./_components/shared-poll-client";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const season = getSeason();
  const ogImage = `/icons/apple-touch-icon-${season}.png`;
  const fallback: Metadata = {
    title: pageTitle("日程調整"),
    openGraph: { images: [ogImage] },
    twitter: { card: "summary", images: [ogImage] },
  };

  try {
    const baseUrl = process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/polls/shared/${token}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return fallback;

    const poll = (await res.json()) as SharedPollResponse;
    const descriptionParts = [
      poll.destination,
      poll.deadline ? `回答期限: ${formatDateFromISO(poll.deadline)}` : null,
    ].filter(Boolean);
    const description = descriptionParts.length > 0 ? descriptionParts.join(" · ") : undefined;

    return {
      title: pageTitle(poll.title),
      description,
      openGraph: {
        title: poll.title,
        description,
        images: [ogImage],
        type: "website",
      },
      twitter: {
        card: "summary",
        title: poll.title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return fallback;
  }
}

export default async function SharedPollPage({ params }: Props) {
  const { token } = await params;

  // Return 404 status for crawlers when token is invalid
  const baseUrl = process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/polls/shared/${token}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) notFound();

  return <SharedPollClient token={token} />;
}

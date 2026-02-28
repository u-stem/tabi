import type { Metadata } from "next";
import { pageTitle } from "@/lib/constants";
import { formatDateRange } from "@/lib/format";
import { getSeason } from "@/lib/season";
import { SharedTripClient } from "./_components/shared-trip-client";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const season = getSeason();
  const ogImage = `/icons/apple-touch-icon-${season}.png`;
  const fallback: Metadata = {
    title: pageTitle("共有プラン"),
    openGraph: { images: [ogImage] },
    twitter: { card: "summary", images: [ogImage] },
  };

  try {
    const baseUrl = process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/shared/${token}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return fallback;

    const trip = await res.json();
    const description = [
      trip.destination,
      trip.startDate && trip.endDate ? formatDateRange(trip.startDate, trip.endDate) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      title: pageTitle(trip.title),
      description,
      openGraph: {
        title: trip.title,
        description,
        images: [ogImage],
        type: "website",
      },
      twitter: {
        card: "summary",
        title: trip.title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    return fallback;
  }
}

export default async function SharedTripPage({ params }: Props) {
  const { token } = await params;
  return <SharedTripClient token={token} />;
}

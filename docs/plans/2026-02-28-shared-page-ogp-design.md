# Shared Page OGP Design

## Overview

Add OGP (Open Graph Protocol) support to `/shared/[token]` so that pasting a shared trip link into LINE, X, Slack, or Discord renders a rich link card showing the trip title, destination, and date range.

## Scope

Phase 2 of the shared page redesign (Phase 1 was the visual redesign).

**In scope:**
- `og:title`, `og:description`, `og:image`, `twitter:card` meta tags
- Static seasonal OGP image (`/icons/apple-touch-icon-{season}.png`)
- Server/Client component split of `app/shared/[token]/page.tsx`

**Out of scope:**
- Dynamic og:image generation (`@vercel/og`) — future work
- Changes to the API or DB schema

## Architecture

Split the current single `"use client"` page into two files:

```
app/shared/[token]/
  page.tsx                          Server Component
                                    - exports generateMetadata()
                                    - renders <SharedTripClient token={token} />
  _components/
    shared-trip-client.tsx          Client Component ("use client")
                                    - existing page logic, nearly unchanged
                                    - receives token as prop instead of useParams()
```

This follows the Next.js App Router composition pattern: Server Component handles metadata and passes serializable props to Client Component.

## page.tsx (Server Component)

```tsx
// No "use client"
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
      trip.startDate && trip.endDate
        ? formatDateRange(trip.startDate, trip.endDate)
        : null,
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
```

## shared-trip-client.tsx (Client Component)

Move all content from the current `page.tsx` here. Minimal changes:

| Change | Before | After |
|--------|--------|-------|
| Directive | already `"use client"` | no change |
| `useParams` import | present | remove |
| Function signature | `SharedTripPage()` | `SharedTripClient({ token }: { token: string })` |
| Token derivation | `const token = typeof params.token === "string" ? params.token : null;` | remove (token is string from prop) |
| useQuery enabled | `enabled: token !== null` | `enabled: true` |
| Export | `export default function SharedTripPage` | `export function SharedTripClient` (named export) |

`SharedHeader`, `PatternSection`, `ScheduleCard` remain in the same file as local functions.

## OGP Image

Uses `/icons/apple-touch-icon-{season}.png` (180×180px, already exists for spring/summer/autumn/winter). Rendered as `twitter:card: "summary"` (small square thumbnail).

`getSeason()` is called at request time, so the image rotates with the season automatically.

## Fetch Caching

`next: { revalidate: 60 }` caches the metadata fetch for 60 seconds per token. This prevents a DB round-trip on every page view while keeping OGP data reasonably fresh.

## Error Handling

- `fetch` throws (network error, BETTER_AUTH_BASE_URL missing): fallback metadata returned, page renders normally via client fetch
- API returns non-2xx (token expired, not found): fallback metadata returned
- Valid trip: full OGP metadata returned

The client-side rendering is completely independent of the metadata fetch — errors in `generateMetadata` never affect page display.

## Environment Variables

No new env vars required. `BETTER_AUTH_BASE_URL` is already set in both local (`.env.local`) and Vercel.

## Testing

Manual verification steps after implementation:
1. Use a social media debugger (e.g., [X Card Validator](https://cards-dev.twitter.com/validator), [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)) to inspect OGP tags
2. `curl -s http://localhost:3000/shared/<token> | grep og:` to verify tags in HTML
3. Paste link in LINE/Slack and confirm rich preview appears
4. Verify fallback: use an invalid token — page shows error, metadata falls back to "共有プラン"

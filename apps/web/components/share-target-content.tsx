"use client";

import type { TripListItem } from "@sugara/shared";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Props = {
  url?: string;
  title?: string;
  text?: string;
};

function extractUrlFromText(text: string): string | null {
  const match = text.match(/https:\/\/\S+/);
  return match ? match[0] : null;
}

export function ShareTargetContent({ url, title, text }: Props) {
  const t = useTranslations("shareTarget");
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const autoAddedRef = useRef(false);

  const resolvedUrl = useMemo(() => {
    if (url) return url;
    if (text) return extractUrlFromText(text);
    return null;
  }, [url, text]);

  const addCandidate = useCallback(
    async (tripId: string) => {
      if (!resolvedUrl) return;
      setAdding(true);
      try {
        const { title: ogpTitle } = await api<{ title: string }>("/api/ogp", {
          params: { url: resolvedUrl },
        });

        const name = ogpTitle || title || resolvedUrl;

        await api(`/api/trips/${tripId}/candidates`, {
          method: "POST",
          body: JSON.stringify({
            name: name.slice(0, 200),
            category: "other" as const,
            color: "blue" as const,
            urls: [resolvedUrl],
          }),
        });

        toast.success(t("added"));
        router.push(`/trips/${tripId}`);
      } catch {
        toast.error(t("addFailed"));
        setAdding(false);
      }
    },
    [resolvedUrl, title, t, router],
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchTrips() {
      try {
        const [owned, shared] = await Promise.all([
          api<TripListItem[]>("/api/trips?scope=owned"),
          api<TripListItem[]>("/api/trips?scope=shared"),
        ]);
        const active = [...owned, ...shared].filter((trip) => trip.status !== "completed");

        if (cancelled) return;
        setTrips(active);

        // Auto-add when only one active trip
        if (active.length === 1 && resolvedUrl && !autoAddedRef.current) {
          autoAddedRef.current = true;
          await addCandidate(active[0].id);
        }
      } catch {
        // Auth failure is handled by middleware redirect
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrips();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">{t("invalidUrl")}</p>
        <Button onClick={() => router.push("/home")}>{t("goHome")}</Button>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">{t("noActiveTrips")}</p>
        <Button onClick={() => router.push("/home")}>{t("goHome")}</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-semibold text-lg">{t("selectTrip")}</h1>
      <div className="flex w-full max-w-sm flex-col gap-2">
        {trips.map((trip) => (
          <button
            key={trip.id}
            type="button"
            disabled={adding}
            className="rounded-lg border p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
            onClick={() => addCandidate(trip.id)}
          >
            <p className="font-medium">{trip.title}</p>
            {trip.destination && (
              <p className="text-muted-foreground text-sm">{trip.destination}</p>
            )}
          </button>
        ))}
      </div>
      {adding && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("adding")}
        </div>
      )}
    </div>
  );
}

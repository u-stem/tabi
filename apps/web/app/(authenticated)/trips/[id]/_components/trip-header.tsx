"use client";

import type { TripResponse } from "@sugara/shared";
import { MAX_MEMBERS_PER_TRIP } from "@sugara/shared";
import { ArrowLeft } from "lucide-react";
import NextLink from "next/link";
import { PresenceAvatars } from "@/components/presence-avatars";
import { TripActions } from "@/components/trip-actions";
import { formatDateRange, getDayCount } from "@/lib/format";
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";

export function TripHeader({
  trip,
  tripId,
  otherPresence,
  isConnected,
  online,
  canEdit,
  onMutate,
  onEditOpen,
}: {
  trip: TripResponse;
  tripId: string;
  otherPresence: PresenceUser[];
  isConnected: boolean;
  online: boolean;
  canEdit: boolean;
  onMutate: () => Promise<void>;
  onEditOpen: () => void;
}) {
  const tripActionsProps = {
    tripId,
    status: trip.status,
    role: trip.role,
    pollId: trip.poll?.id,
    onStatusChange: onMutate,
    onEdit: canEdit ? onEditOpen : undefined,
    disabled: !online,
    memberLimitReached: trip.memberCount >= MAX_MEMBERS_PER_TRIP,
  } as const;

  return (
    <div className="mb-2 lg:mb-6">
      {/* Mobile compact header */}
      <div className="flex h-11 items-center gap-2 lg:hidden">
        <NextLink
          href="/home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </NextLink>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold">{trip.title}</h1>
        <PresenceAvatars users={otherPresence} isConnected={isConnected} />
        <TripActions {...tripActionsProps} compact />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold">{trip.title}</h1>
          <PresenceAvatars users={otherPresence} isConnected={isConnected} />
        </div>
        <p className="text-muted-foreground">
          {trip.startDate && trip.endDate ? (
            <>
              {trip.destination ? `${trip.destination} / ` : null}
              {formatDateRange(trip.startDate, trip.endDate)}
              <span className="ml-2 text-sm">
                ({getDayCount(trip.startDate, trip.endDate)}日間)
              </span>
            </>
          ) : (
            trip.destination
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TripActions {...tripActionsProps} />
        </div>
      </div>
    </div>
  );
}

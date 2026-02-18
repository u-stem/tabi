"use client";

import type { TripResponse } from "@sugara/shared";
import { MAX_MEMBERS_PER_TRIP } from "@sugara/shared";
import { List } from "lucide-react";
import { PresenceAvatars } from "@/components/presence-avatars";
import { TripActions } from "@/components/trip-actions";
import { Button } from "@/components/ui/button";
import { formatDateRange, getDayCount } from "@/lib/format";
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";

export function TripHeader({
  trip,
  tripId,
  otherPresence,
  isConnected,
  candidateCount,
  online,
  canEdit,
  onMutate,
  onEditOpen,
  onCandidateOpen,
}: {
  trip: TripResponse;
  tripId: string;
  otherPresence: PresenceUser[];
  isConnected: boolean;
  candidateCount: number;
  online: boolean;
  canEdit: boolean;
  onMutate: () => Promise<void>;
  onEditOpen: () => void;
  onCandidateOpen: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 truncate text-2xl font-bold">{trip.title}</h1>
        <PresenceAvatars users={otherPresence} isConnected={isConnected} />
      </div>
      <p className="text-muted-foreground">
        {trip.startDate && trip.endDate ? (
          <>
            {`${trip.destination} / `}
            {formatDateRange(trip.startDate, trip.endDate)}
            <span className="ml-2 text-sm">({getDayCount(trip.startDate, trip.endDate)}日間)</span>
          </>
        ) : (
          trip.destination
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TripActions
          tripId={tripId}
          status={trip.status}
          role={trip.role}
          onStatusChange={onMutate}
          onEdit={canEdit ? onEditOpen : undefined}
          disabled={!online}
          memberLimitReached={trip.memberCount >= MAX_MEMBERS_PER_TRIP}
        />
        <Button variant="outline" size="sm" onClick={onCandidateOpen} className="ml-auto lg:hidden">
          <List className="h-4 w-4" />
          <span>候補</span>
          {candidateCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-xs">{candidateCount}</span>
          )}
        </Button>
      </div>
    </div>
  );
}

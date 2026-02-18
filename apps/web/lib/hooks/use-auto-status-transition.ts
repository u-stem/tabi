import type { TripResponse } from "@sugara/shared";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getTimeStatus, toDateString } from "@/lib/format";
import { MSG } from "@/lib/messages";

const MAX_RETRIES = 3;

/**
 * Auto-transition trip status:
 *   planned -> active  (when first spot starts or startDate has passed)
 *   active  -> completed (when all spots on endDate are done or endDate has passed)
 */
export function useAutoStatusTransition({
  trip,
  tripId,
  now,
  onMutate,
}: {
  trip: TripResponse | null;
  tripId: string;
  now: string;
  onMutate: () => void;
}) {
  const triggered = useRef(false);
  const retryCount = useRef(0);

  // Reset when status changes
  useEffect(() => {
    triggered.current = false;
    retryCount.current = 0;
  }, [trip?.status]);

  useEffect(() => {
    if (!trip || triggered.current) return;
    // Only owner/editor can change status; skip for viewer to avoid infinite retry
    if (trip.role === "viewer") return;

    const todayStr = toDateString(new Date());

    let nextStatus: string | null = null;
    let message = "";

    if (trip.status === "planned" && trip.startDate) {
      let shouldActivate = false;
      if (todayStr > trip.startDate) {
        shouldActivate = true;
      } else if (todayStr === trip.startDate) {
        const todaySchedules = trip.days
          .filter((d) => d.date === todayStr)
          .flatMap((d) => d.patterns.flatMap((p) => p.schedules));
        shouldActivate = todaySchedules.some(
          (spot) => getTimeStatus(now, spot.startTime, spot.endTime) !== "future",
        );
      }
      if (shouldActivate) {
        nextStatus = "active";
        message = MSG.TRIP_AUTO_IN_PROGRESS;
      }
    } else if (trip.status === "active" && trip.endDate) {
      let allDone = false;
      if (todayStr > trip.endDate) {
        allDone = true;
      } else if (todayStr === trip.endDate) {
        const todaySchedules = trip.days
          .filter((d) => d.date === todayStr)
          .flatMap((d) => d.patterns.flatMap((p) => p.schedules));
        if (todaySchedules.length > 0) {
          allDone = todaySchedules.every(
            (spot) => getTimeStatus(now, spot.startTime, spot.endTime) === "past",
          );
        }
      }
      if (allDone) {
        nextStatus = "completed";
        message = MSG.TRIP_AUTO_COMPLETED;
      }
    }

    if (nextStatus) {
      triggered.current = true;
      api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      })
        .then(() => {
          toast.success(message);
          onMutate();
        })
        .catch(() => {
          retryCount.current += 1;
          if (retryCount.current < MAX_RETRIES) {
            triggered.current = false;
          }
        });
    }
  }, [trip, now, tripId, onMutate]);
}

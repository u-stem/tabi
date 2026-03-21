"use client";

import { useTranslations } from "next-intl";
import { memo } from "react";
import { SouvenirPanel } from "@/components/souvenir-panel";

type SouvenirTabProps = {
  tripId: string;
  hasDays: boolean;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export const SouvenirTab = memo(function SouvenirTab({
  tripId,
  hasDays,
  addOpen,
  onAddOpenChange,
}: SouvenirTabProps) {
  const tsch = useTranslations("schedule");
  if (!hasDays) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tsch("schedulesNotAvailable", { feature: tsch("souvenirs") })}
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <SouvenirPanel tripId={tripId} addOpen={addOpen} onAddOpenChange={onAddOpenChange} />
    </div>
  );
});

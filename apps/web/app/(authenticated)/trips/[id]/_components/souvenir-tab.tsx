"use client";

import { SouvenirPanel } from "@/components/souvenir-panel";

type SouvenirTabProps = {
  tripId: string;
  hasDays: boolean;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export function SouvenirTab({ tripId, hasDays, addOpen, onAddOpenChange }: SouvenirTabProps) {
  if (!hasDays) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        日程が確定するとお土産リストを利用できます
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <SouvenirPanel tripId={tripId} addOpen={addOpen} onAddOpenChange={onAddOpenChange} />
    </div>
  );
}

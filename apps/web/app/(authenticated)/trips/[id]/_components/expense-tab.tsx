"use client";

import { ExpensePanel } from "@/components/expense-panel";

type ExpenseTabProps = {
  tripId: string;
  canEdit: boolean;
  hasDays: boolean;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export function ExpenseTab({
  tripId,
  canEdit,
  hasDays,
  addOpen,
  onAddOpenChange,
}: ExpenseTabProps) {
  if (!hasDays) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        日程が確定すると費用を記録できます
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <ExpensePanel
        tripId={tripId}
        canEdit={canEdit}
        addOpen={addOpen}
        onAddOpenChange={onAddOpenChange}
      />
    </div>
  );
}

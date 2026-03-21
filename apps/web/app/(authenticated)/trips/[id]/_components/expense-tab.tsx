"use client";

import { useTranslations } from "next-intl";
import { memo } from "react";
import { ExpensePanel } from "@/components/expense-panel";

type ExpenseTabProps = {
  tripId: string;
  canEdit: boolean;
  hasDays: boolean;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export const ExpenseTab = memo(function ExpenseTab({
  tripId,
  canEdit,
  hasDays,
  addOpen,
  onAddOpenChange,
}: ExpenseTabProps) {
  const tsch = useTranslations("schedule");
  if (!hasDays) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tsch("schedulesNotAvailable", { feature: tsch("expenses") })}
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
});

type SpotItemProps = {
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  onDelete: () => void;
};

const categoryLabels: Record<string, string> = {
  sightseeing: "Sight",
  restaurant: "Food",
  hotel: "Hotel",
  transport: "Move",
  activity: "Play",
  other: "Other",
};

export function SpotItem({
  name,
  category,
  startTime,
  endTime,
  memo,
  onDelete,
}: SpotItemProps) {
  const timeStr =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime
        ? startTime
        : "";

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
        {categoryLabels[category] ?? category}
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium">{name}</span>
          <button
            onClick={onDelete}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Delete
          </button>
        </div>
        {timeStr && (
          <p className="text-xs text-muted-foreground">{timeStr}</p>
        )}
        {memo && (
          <p className="mt-1 text-sm text-muted-foreground">{memo}</p>
        )}
      </div>
    </div>
  );
}

export function DndInsertIndicator() {
  return (
    <div className="flex items-center gap-2 py-1" aria-hidden="true">
      <div className="h-2 w-2 rounded-full bg-blue-500" />
      <div className="h-0.5 flex-1 bg-blue-500" />
    </div>
  );
}

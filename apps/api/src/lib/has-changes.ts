/**
 * Compare update payload against existing record.
 * Returns true if any defined field in updates differs from existing.
 */
export function hasChanges(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): boolean {
  return Object.entries(updates).some(([key, value]) => {
    if (value === undefined) return false;
    const current = existing[key];
    if (value instanceof Date && current instanceof Date) {
      return value.getTime() !== current.getTime();
    }
    if (value instanceof Date || current instanceof Date) {
      return true;
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value) !== JSON.stringify(current);
    }
    return value !== current;
  });
}

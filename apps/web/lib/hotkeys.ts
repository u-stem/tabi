/**
 * Returns true if a modal dialog or drawer is currently open.
 * Uses DOM check so it works regardless of which component opened it.
 */
export function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

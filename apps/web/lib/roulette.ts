export function pickRandom<T>(candidates: T[]): T {
  if (candidates.length === 0) throw new Error("No candidates");
  return candidates[Math.floor(Math.random() * candidates.length)];
}

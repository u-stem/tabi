function vibrate(pattern: number | number[]): void {
  navigator?.vibrate?.(pattern);
}

export const haptics = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  heavy: () => vibrate([30, 10, 30]),
  success: () => vibrate([10, 50, 10]),
  error: () => vibrate([50, 30, 50, 30, 50]),
} as const;

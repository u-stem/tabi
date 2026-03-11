import { useCallback, useEffect, useRef, useState } from "react";
import { pickRandom } from "../roulette";

type RouletteState = "idle" | "spinning" | "result";

export function useRoulette(candidates: string[]) {
  const [state, setState] = useState<RouletteState>("idle");
  const [display, setDisplay] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const spin = useCallback(() => {
    if (candidates.length === 0) return;

    setState("spinning");
    const result = pickRandom(candidates);
    const totalTicks = 20;

    const schedule = (tick: number) => {
      timerRef.current = setTimeout(
        () => {
          if (tick >= totalTicks) {
            setDisplay(result);
            setState("result");
          } else {
            setDisplay(pickRandom(candidates));
            schedule(tick + 1);
          }
        },
        80 + tick * 8,
      );
    };
    schedule(0);
  }, [candidates]);

  const reset = useCallback(() => {
    clearTimer();
    setState("idle");
    setDisplay("");
  }, [clearTimer]);

  return { state, display, spin, reset };
}

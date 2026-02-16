import { useEffect, useState } from "react";

function formatHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function useCurrentTime(): string {
  const [time, setTime] = useState(formatHHMM);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(formatHHMM());
    }, 60_000);
    function handleVisibilityChange() {
      if (!document.hidden) {
        setTime(formatHHMM());
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return time;
}

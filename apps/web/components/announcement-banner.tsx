"use client";

import { useEffect, useState } from "react";

export function AnnouncementBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcement")
      .then((r) => r.json() as Promise<{ message: string | null }>)
      .then((data) => {
        setMessage(data?.message || null);
      })
      .catch(() => {
        // Non-critical — silently ignore fetch errors
      });
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="animate-in slide-in-from-top fade-in duration-300 bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-yellow-950 dark:bg-yellow-600 dark:text-yellow-100"
    >
      {message}
    </div>
  );
}

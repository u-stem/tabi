"use client";

import { useEffect } from "react";
import { RouletteContent } from "@/components/roulette-content";
import { pageTitle } from "@/lib/constants";

export default function RoulettePage() {
  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      <RouletteContent />
    </div>
  );
}

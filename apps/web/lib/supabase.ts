import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:55321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey && process.env.NODE_ENV === "production") {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || "", {
  realtime: {
    worker: true,
  },
});

if (typeof window !== "undefined") {
  // Surface transport-level close codes to diagnose Realtime reconnect storms.
  // 1006 = abnormal close, 1008 = policy violation (auth), 4xxx = Phoenix-level.
  // RealtimeClient has no public onClose/onError; stateChangeCallbacks is the
  // documented extension point and is typed as a public field.
  supabase.realtime.stateChangeCallbacks.close.push((e: CloseEvent) => {
    console.warn(`[Realtime][socket] close code=${e?.code ?? "?"} reason=${e?.reason || "(none)"}`);
  });
  supabase.realtime.stateChangeCallbacks.error.push((e: Event) => {
    console.warn("[Realtime][socket] error", e);
  });
}

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // Placed before defaultCache to override its navigation handler.
    // defaultCache uses NetworkFirst without a timeout, which causes
    // infinite loading when offline. This adds a 3s timeout so that
    // offline navigation falls back to cache instead of hanging.
    {
      matcher: ({ request }: { request: Request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "navigations",
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Push notification handlers (separate from serwist)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data: unknown;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as Record<string, unknown>).title !== "string" ||
    typeof (data as Record<string, unknown>).body !== "string" ||
    typeof (data as Record<string, unknown>).url !== "string"
  ) {
    return;
  }

  const { title, body, url } = data as { title: string; body: string; url: string };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const path = (event.notification.data as { url: string }).url;
      const existing = clientList.find((c) => new URL(c.url).pathname === path);
      if (existing) return existing.focus();
      return self.clients.openWindow(path);
    }),
  );
});

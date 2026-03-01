"use client";

import { useEffect } from "react";
import { api } from "../api";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0))) as Uint8Array<ArrayBuffer>;
}

async function subscribeToVapid(registration: ServiceWorkerRegistration): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await api("/api/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  });
}

/**
 * Requests push notification permission and subscribes if granted.
 * Call this in response to an explicit user action (button click).
 */
export async function requestPushPermission(): Promise<"granted" | "denied" | "default"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "denied";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const registration = await navigator.serviceWorker.ready;
  await subscribeToVapid(registration);
  return permission;
}

/**
 * If the user has already granted permission, silently registers the push subscription.
 * Does NOT prompt for permission — call requestPushPermission() for explicit opt-in.
 */
export function usePushSubscription(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // Only auto-subscribe when permission is already granted; never auto-prompt
    if (Notification.permission !== "granted") return;

    const timer = setTimeout(async () => {
      const registration = await navigator.serviceWorker.ready;
      await subscribeToVapid(registration);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);
}

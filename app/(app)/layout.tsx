"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OfflineIndicator } from "@/components/ui";
import { replayOfflineQueue } from "@/lib/offline/sync-queue";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Disable old cache-first service worker to prevent stale /map bundles.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {
          /* ignore */
        });
    }

    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sapd-shell-")).map((k) => caches.delete(k))))
        .catch(() => {
          /* ignore */
        });
    }

    // Replay queued mutations when coming back online
    const handleOnline = () => replayOfflineQueue().catch(() => {/* ignore */});
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <OfflineIndicator />
      <Header />
      <main className="flex-1 overflow-hidden">{children}</main>
      <MobileNav />
    </div>
  );
}

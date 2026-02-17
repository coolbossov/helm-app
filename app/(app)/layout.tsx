"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OfflineIndicator } from "@/components/ui";
import { replayOfflineQueue } from "@/lib/offline/sync-queue";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {/* ignore */});
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

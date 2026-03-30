"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Map, Route, Settings, Telescope } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/map?mode=leads", label: "Leads", icon: Telescope, matchPath: "/map", matchMode: "leads" },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isNavItemActive(
  item: { href: string; matchPath?: string; matchMode?: string },
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
): boolean {
  if (item.matchPath && item.matchMode) {
    return pathname === item.matchPath && searchParams.get("mode") === item.matchMode;
  }
  if (item.href === "/map") {
    return pathname === "/map" && searchParams.get("mode") !== "leads";
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white sm:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-[48px] flex-col items-center gap-0.5 rounded-lg px-3 py-1",
              isNavItemActive(item, pathname, searchParams)
                ? "text-blue-600"
                : "text-gray-400"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

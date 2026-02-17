"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Route, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white sm:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-[48px] flex-col items-center gap-0.5 rounded-lg px-3 py-1",
              pathname === item.href
                ? "text-blue-600"
                : "text-gray-400"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, Users, Bell, RefreshCcw, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Overview",    icon: LayoutDashboard },
  { href: "/services",  label: "Services",    icon: Activity },
  { href: "/users",     label: "Users",       icon: Users },
  { href: "/cache",     label: "Cache",       icon: RefreshCcw },
  { href: "/alerts",    label: "Alerts",      icon: Bell },
  { href: "/settings",  label: "Settings",    icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border/60 bg-background flex flex-col h-full">
      <div className="px-5 h-14 flex items-center border-b border-border/60">
        <span className="font-semibold text-sm tracking-tight">lumea admin</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 h-9 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-md px-3 h-9 text-sm text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-colors w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

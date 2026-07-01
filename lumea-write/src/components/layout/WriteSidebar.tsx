"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, BarChart2, Bell, Settings, PenLine, LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",           label: "Dashboard",    icon: LayoutDashboard },
  { href: "/posts",      label: "Posts",        icon: FileText },
  { href: "/analytics",  label: "Analytics",    icon: BarChart2 },
  { href: "/notifications", label: "Inbox",     icon: Bell },
  { href: "/settings",   label: "Settings",     icon: Settings },
];

export function WriteSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border/60 bg-background h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border/60">
        <Link href="/" className="font-semibold text-base tracking-tight">
          lumea <span className="text-muted-foreground font-normal">write</span>
        </Link>
      </div>

      {/* New post CTA */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/posts/new"
          className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground h-8 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <PenLine className="h-3.5 w-3.5" />
          New post
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 pt-2 border-t border-border/60 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-accent/50 transition-colors"
        >
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="text-xs">
              {user?.name?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-destructive transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

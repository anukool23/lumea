"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Bell, PenLine, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-1.5 font-semibold text-lg tracking-tight shrink-0"
          >
            <span className="text-zinc-900">lumea</span>
            <span className="text-zinc-400">·</span>
          </Link>

          {/* Search bar — desktop */}
          <form
            onSubmit={handleSearch}
            className="hidden sm:flex flex-1 max-w-sm relative"
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
            />
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-8 w-8"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </Button>

            {user ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 relative" asChild>
                  <Link href="/notifications" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="hidden sm:flex gap-1.5 h-8" asChild>
                  <Link href={process.env.NEXT_PUBLIC_WRITE_URL ?? "https://write.lumea.ink"}>
                    <PenLine className="h-3.5 w-3.5" />
                    Write
                  </Link>
                </Button>
                <button
                  onClick={() => router.push(`/u/${user.username}`)}
                  className="ml-1"
                >
                  <Avatar className="h-7 w-7 cursor-pointer ring-2 ring-transparent hover:ring-zinc-200 transition-all">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="text-xs">
                      {user.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="h-8 hidden sm:flex" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" className="h-8" asChild>
                  <Link href="/register">Get started</Link>
                </Button>
              </>
            )}

            {/* Mobile menu */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-8 w-8 ml-1"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile search */}
        {searchOpen && (
          <form onSubmit={handleSearch} className="sm:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts…"
                className="pl-8 h-9 text-sm"
              />
            </div>
          </form>
        )}

        {/* Mobile nav */}
        {mobileOpen && (
          <nav
            className={cn(
              "sm:hidden pb-4 border-t border-border/60 pt-3 flex flex-col gap-1"
            )}
          >
            <Link
              href="/"
              className="px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/search"
              className="px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Search
            </Link>
            <Link
              href="/bookmarks"
              className="px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Bookmarks
            </Link>
            {!user && (
              <Link
                href="/login"
                className="px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            )}
            {user && (
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left text-destructive"
              >
                Sign out
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, PenSquare, Search, User } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { auth } from "@/lib/api";
import { useState } from "react";
import Image from "next/image";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="font-semibold text-lg tracking-tight text-zinc-900 shrink-0">
          Lumea
        </Link>

        {/* Search */}
        <Link href="/search" className="hidden sm:flex flex-1 max-w-xs items-center gap-2 bg-zinc-100 rounded-full px-4 py-1.5 text-sm text-zinc-400 hover:bg-zinc-200 transition-colors">
          <Search className="w-4 h-4" />
          Search stories...
        </Link>

        {/* Right actions */}
        <nav className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link href="http://localhost:3001" target="_blank"
                className="hidden sm:flex btn-outline text-xs py-1.5 gap-1">
                <PenSquare className="w-4 h-4" />
                Write
              </Link>
              <Link href="/notifications" className="p-2 rounded-full hover:bg-zinc-100 relative">
                <Bell className="w-5 h-5" />
              </Link>
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2">
                  {user?.profile_picture ? (
                    <Image src={user.profile_picture} alt={user.username} width={32} height={32} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-zinc-200 py-1 z-50">
                    <Link href={`/u/${user?.username}`} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-zinc-50" onClick={() => setMenuOpen(false)}>
                      <User className="w-4 h-4" /> Profile
                    </Link>
                    <Link href="/bookmarks" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-zinc-50" onClick={() => setMenuOpen(false)}>
                      <BookOpen className="w-4 h-4" /> Bookmarks
                    </Link>
                    <hr className="my-1 border-zinc-100" />
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-zinc-50">
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900 px-3 py-1.5">Sign in</Link>
              <Link href="/register" className="btn-primary text-xs py-1.5">Get started</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

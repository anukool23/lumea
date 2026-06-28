"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, BarChart2, Settings,
  LogOut, PenSquare, ExternalLink, User,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/posts", label: "Stories", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    router.push("/login");
  };

  const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3000";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-zinc-200 flex flex-col fixed inset-y-0 left-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-zinc-100">
          <Link href="/" className="font-semibold text-lg tracking-tight">Lumea</Link>
          <span className="ml-2 text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">Writer</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}

          <hr className="my-2 border-zinc-100" />

          <Link href="/posts/new"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors">
            <PenSquare className="w-4 h-4" />
            New story
          </Link>

          <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors">
            <ExternalLink className="w-4 h-4" />
            View portal
          </a>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden shrink-0">
              {user?.profile_picture
                ? <Image src={user.profile_picture} alt={user.username} width={32} height={32} className="object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xs font-medium">{user?.username?.[0]?.toUpperCase()}</div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? user?.username}</p>
              <p className="text-xs text-zinc-400 truncate">@{user?.username}</p>
            </div>
            <button onClick={handleLogout} className="text-zinc-400 hover:text-zinc-700 p-1" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 min-h-screen">{children}</main>
    </div>
  );
}

"use client";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

interface Props {
  authorUsername: string;
  previewContent: string;
}

export function PremiumGate({ authorUsername, previewContent }: Props) {
  const { isAuthenticated } = useAuthStore();

  return (
    <div>
      {/* Faded preview */}
      <div className="premium-fade max-h-40 overflow-hidden mb-0">
        <div
          className="prose-lumea text-zinc-600"
          dangerouslySetInnerHTML={{ __html: previewContent }}
        />
      </div>

      {/* Gate card */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-8 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-xl font-bold mb-2">This story is for supporters</h3>
        <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
          Support <Link href={`/u/${authorUsername}`} className="font-medium text-zinc-900 hover:underline">@{authorUsername}</Link> to get full access to this and all premium stories on Lumea.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isAuthenticated ? (
            <>
              <Link href={`/u/${authorUsername}#support`} className="btn-primary">
                Become a supporter
              </Link>
              <Link href="/settings/membership" className="btn-outline">
                View plans
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" className="btn-primary">
                Create free account
              </Link>
              <Link href="/login" className="btn-outline">
                Sign in
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-4">Lumea supporters get unlimited access to all premium content.</p>
      </div>
    </div>
  );
}

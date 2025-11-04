"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/feed");
    }
  }, [loading, router, user]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6 text-white">
      <div className="w-full max-w-4xl space-y-10 text-center">
        <div className="space-y-6">
          <p className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm uppercase tracking-[0.2em] text-slate-200">
            Zcomu Social
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Proof-of-concept social layer built for Supabase
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-200/80">
            Manage profiles, create posts with media, comment, react, and keep
            storage metadata in sync. This POC covers the full stack that sits
            on top of your Supabase schema.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">Sign in to start</Link>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => router.push("/feed")}
          >
            Explore the feed
          </Button>
        </div>
      </div>
    </main>
  );
}

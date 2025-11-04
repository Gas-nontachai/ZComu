"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

export function useHomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/feed");
    }
  }, [loading, router, user]);

  const exploreFeed = () => {
    router.push("/feed");
  };

  return {
    exploreFeed,
    loading,
    user,
  };
}

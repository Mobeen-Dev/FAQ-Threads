"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  // Show loading while determining auth state
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
    </div>
  );
}

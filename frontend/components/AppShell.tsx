"use client";

import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useTheme } from "@/hooks/useTheme";
import Sidebar from "@/components/Sidebar";
import MaterialIcon from "@/components/MaterialIcon";
import { useEffect } from "react";
import Link from "next/link";

const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage = publicPaths.includes(pathname);

  useEffect(() => {
    if (!loading && !isPublicPage && !user) {
      router.replace("/login");
    }
  }, [loading, isPublicPage, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-zinc-950">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-stone-200 dark:border-zinc-800">
          <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto">
            {[
              { href: "/dashboard", icon: "dashboard" },
              { href: "/questions", icon: "help" },
              { href: "/answers", icon: "chat" },
              { href: "/contributors", icon: "group" },
              { href: "/analytics", icon: "monitoring" },
              { href: "/settings", icon: "settings" },
              { href: "/account", icon: "account_circle" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  pathname === item.href
                    ? "bg-teal-600 text-white"
                    : "bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300"
                }`}
              >
                <MaterialIcon name={item.icon} className="text-[1.2rem]" />
              </Link>
            ))}
            <button
              onClick={toggleTheme}
              className="shrink-0 w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300"
              aria-label="Toggle theme"
            >
              <MaterialIcon name={theme === "dark" ? "light_mode" : "dark_mode"} className="text-[1.2rem]" />
            </button>
            <button
              onClick={logout}
              className="shrink-0 w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300"
              aria-label="Sign out"
            >
              <MaterialIcon name="logout" className="text-[1.2rem]" />
            </button>
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8 text-stone-900 dark:text-zinc-100">{children}</main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent>{children}</AppContent>
      </AuthProvider>
    </ThemeProvider>
  );
}

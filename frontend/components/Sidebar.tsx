"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/questions", label: "Questions", icon: "❓" },
  { href: "/contributors", label: "Contributors", icon: "👥" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/credentials", label: "Shopify Store", icon: "🔗" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 bg-zinc-900 dark:bg-zinc-950 text-white min-h-screen p-4 flex flex-col border-r border-zinc-800">
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-teal-400">FAQ</span> Manager
        </h1>
        <p className="text-zinc-400 text-sm mt-1 truncate">{user?.email}</p>
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 pt-4 border-t border-zinc-800">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors w-full"
        >
          <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors w-full"
        >
          <span className="text-lg">🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

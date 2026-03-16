"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import MaterialIcon from "@/components/MaterialIcon";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/questions", label: "Questions", icon: "help" },
  { href: "/answers", label: "Answers", icon: "chat" },
  { href: "/contributors", label: "Contributors", icon: "group" },
  { href: "/analytics", label: "Analytics", icon: "monitoring" },
  { href: "/credentials", label: "Shopify Store", icon: "storefront" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 bg-white dark:bg-zinc-950 text-stone-900 dark:text-zinc-100 min-h-screen p-4 flex flex-col border-r border-stone-200 dark:border-zinc-800">
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-teal-600 dark:text-teal-400">FAQ</span> Manager
        </h1>
        <p className="text-stone-500 dark:text-zinc-400 text-sm mt-1 truncate">{user?.email}</p>
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
                  : "text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-900 dark:hover:text-zinc-100"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[1.25rem]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 pt-4 border-t border-stone-200 dark:border-zinc-800">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors w-full"
        >
          <MaterialIcon name={theme === "dark" ? "light_mode" : "dark_mode"} className="text-[1.25rem]" />
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors w-full"
        >
          <MaterialIcon name="logout" className="text-[1.25rem]" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

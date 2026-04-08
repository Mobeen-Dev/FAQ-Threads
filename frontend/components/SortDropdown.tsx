"use client";

import MaterialIcon from "@/components/MaterialIcon";

export type SortOption = "newest" | "oldest" | "popular";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
  showPopular?: boolean;
}

export default function SortDropdown({ value, onChange, className = "", showPopular = true }: SortDropdownProps) {
  const getDisplayText = () => {
    if (value === "newest") return "Newest First";
    if (value === "oldest") return "Oldest First";
    if (value === "popular") return "Most Popular";
    return "Sort by...";
  };

  return (
    <div className={`flex items-center gap-2 border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 ${className}`}>
      <MaterialIcon name="sort" className="text-base text-stone-400 dark:text-zinc-500" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="bg-transparent border-none outline-none text-sm flex-1 cursor-pointer"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        {showPopular && <option value="popular">Most Popular</option>}
      </select>
    </div>
  );
}

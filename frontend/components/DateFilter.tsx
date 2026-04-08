"use client";

import { useState, useRef, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { getDaysAgo, formatDateShort } from "@/utils/date";

export type DateFilterValue = "24h" | "7d" | "30d" | "custom" | "all";

export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

interface DateFilterProps {
  value: DateFilterValue;
  dateRange?: DateRange;
  onChange: (value: DateFilterValue, dateRange?: DateRange) => void;
  className?: string;
}

export default function DateFilter({ value, dateRange, onChange, className = "" }: DateFilterProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCustomPicker) return;
    
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false);
      }
    }
    
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCustomPicker]);

  const handleFilterChange = (newValue: DateFilterValue) => {
    if (newValue === "custom") {
      setShowCustomPicker(true);
      return;
    }
    
    setShowCustomPicker(false);
    
    let newRange: DateRange | undefined;
    
    if (newValue === "24h") {
      newRange = { startDate: getDaysAgo(1) };
    } else if (newValue === "7d") {
      newRange = { startDate: getDaysAgo(7) };
    } else if (newValue === "30d") {
      newRange = { startDate: getDaysAgo(30) };
    }
    
    onChange(newValue, newRange);
  };

  const applyCustomRange = () => {
    if (!customStart) {
      alert("Please select a start date");
      return;
    }
    
    const start = new Date(customStart);
    const end = customEnd ? new Date(customEnd) : new Date();
    
    onChange("custom", { startDate: start, endDate: end });
    setShowCustomPicker(false);
  };

  const getDisplayText = () => {
    if (value === "24h") return "Last 24 hours";
    if (value === "7d") return "Last 7 days";
    if (value === "30d") return "Last 30 days";
    if (value === "custom" && dateRange?.startDate) {
      const start = formatDateShort(dateRange.startDate);
      const end = dateRange.endDate ? formatDateShort(dateRange.endDate) : "Now";
      return `${start} - ${end}`;
    }
    return "All time";
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100">
        <MaterialIcon name="calendar_today" className="text-base text-stone-400 dark:text-zinc-500" />
        <select
          value={value}
          onChange={(e) => handleFilterChange(e.target.value as DateFilterValue)}
          className="bg-transparent border-none outline-none text-sm flex-1 cursor-pointer"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom range...</option>
        </select>
      </div>

      {showCustomPicker && (
        <div
          ref={pickerRef}
          className="absolute top-full mt-2 right-0 bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-stone-200 dark:border-zinc-700 p-4 z-50 w-80"
        >
          <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100 mb-3">Custom Date Range</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-stone-600 dark:text-zinc-400 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full border border-stone-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs text-stone-600 dark:text-zinc-400 mb-1">End Date (optional)</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                min={customStart}
                className="w-full border border-stone-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-stone-900 dark:text-zinc-100 text-sm"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCustomPicker(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomRange}
                className="flex-1 px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

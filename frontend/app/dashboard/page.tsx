"use client";

import StatCard from "@/components/StatCard";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type AnalyticsData } from "@/services/shopifyApi";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data, loading, error } = useFetch<AnalyticsData>(
    () => shopifyApi.getAnalytics(),
    [user?.id]
  );

  if (!user) return null;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  if (error) {
    return <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 p-4 rounded-xl">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Questions" value={data?.totalQuestions ?? 0} icon="❓" color="bg-teal-500" />
        <StatCard title="Published" value={data?.published ?? 0} icon="✅" color="bg-emerald-500" />
        <StatCard title="Pending Review" value={data?.pending ?? 0} icon="⏳" color="bg-amber-500" />
        <StatCard title="Categories" value={data?.categories ?? 0} icon="📁" color="bg-violet-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Quick Actions</h2>
          <div className="space-y-3">
            <a href="/questions" className="block px-4 py-3 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
              ➕ Add New Question
            </a>
            <a href="/questions?status=pending" className="block px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
              👀 Review Pending Questions ({data?.pending ?? 0})
            </a>
            <a href="/analytics" className="block px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
              📈 View Analytics
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Getting Started</h2>
          <ol className="space-y-3 text-stone-600 dark:text-zinc-400">
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</span>
              Create FAQ categories to organize your questions
            </li>
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
              Add frequently asked questions and answers
            </li>
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
              Configure the FAQ widget in Settings
            </li>
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</span>
              Publish and monitor via Analytics
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

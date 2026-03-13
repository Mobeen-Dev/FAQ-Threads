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

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Questions" value={data?.totalQuestions ?? 0} icon="❓" color="bg-teal-500" />
        <StatCard title="Published" value={data?.published ?? 0} icon="✅" color="bg-emerald-500" />
        <StatCard title="Pending Review" value={data?.pending ?? 0} icon="⏳" color="bg-amber-500" />
        <StatCard title="Categories" value={data?.categories ?? 0} icon="📁" color="bg-violet-500" />
      </div>

      {/* New: Answers & Contributors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Answers" value={data?.totalAnswers ?? 0} icon="💬" color="bg-sky-500" />
        <StatCard title="Published Answers" value={data?.publishedAnswers ?? 0} icon="📢" color="bg-emerald-500" />
        <StatCard title="Contributors" value={data?.totalContributors ?? 0} icon="👥" color="bg-teal-500" />
        <StatCard title="Trusted" value={data?.trustedContributors ?? 0} icon="⭐" color="bg-violet-500" />
      </div>

      {/* Suspended warning */}
      {(data?.suspended ?? 0) > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-200 dark:border-orange-800 p-4 flex items-center gap-3 mb-6">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-orange-700 dark:text-orange-300">{data?.suspended} suspended question{(data?.suspended ?? 0) !== 1 ? "s" : ""}</p>
            <p className="text-sm text-orange-600 dark:text-orange-400">Review suspended content in the Questions page.</p>
          </div>
        </div>
      )}

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
            <a href="/contributors" className="block px-4 py-3 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors">
              👥 Manage Contributors
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
              Add your Shopify credentials in Settings
            </li>
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
              Create FAQ categories and questions
            </li>
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
              Configure publishing rules in Settings
            </li>
            <li className="flex gap-3">
              <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</span>
              Paste webhook URL in your storefront for Q&A
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

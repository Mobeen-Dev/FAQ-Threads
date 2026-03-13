"use client";

import StatCard from "@/components/StatCard";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type AnalyticsData } from "@/services/shopifyApi";

export default function AnalyticsPage() {
  const { user } = useAuth();

  const { data, loading, error } = useFetch<AnalyticsData>(
    () => shopifyApi.getAnalytics(),
    [user?.id]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 p-4 rounded-xl">Error: {error}</div>;
  }

  const stats = data || { totalQuestions: 0, published: 0, pending: 0, categories: 0 };
  const publishRate = stats.totalQuestions > 0
    ? Math.round((stats.published / stats.totalQuestions) * 100)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total FAQs" value={stats.totalQuestions} icon="📋" color="bg-teal-500" />
        <StatCard title="Published" value={stats.published} icon="✅" color="bg-emerald-500" />
        <StatCard title="Pending Review" value={stats.pending} icon="⏳" color="bg-amber-500" />
        <StatCard title="Publish Rate" value={`${publishRate}%`} icon="📊" color="bg-violet-500" />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Content Overview</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-stone-600 dark:text-zinc-400">Published</span>
                <span className="font-medium text-stone-900 dark:text-zinc-100">{stats.published}</span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.totalQuestions > 0 ? (stats.published / stats.totalQuestions) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-stone-600 dark:text-zinc-400">Pending</span>
                <span className="font-medium text-stone-900 dark:text-zinc-100">{stats.pending}</span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.totalQuestions > 0 ? (stats.pending / stats.totalQuestions) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-stone-600 dark:text-zinc-400">Rejected</span>
                <span className="font-medium text-stone-900 dark:text-zinc-100">{stats.totalQuestions - stats.published - stats.pending}</span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.totalQuestions > 0 ? ((stats.totalQuestions - stats.published - stats.pending) / stats.totalQuestions) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-stone-200 dark:border-zinc-700">
              <span className="text-stone-600 dark:text-zinc-400">Total Categories</span>
              <span className="font-semibold text-stone-900 dark:text-zinc-100">{stats.categories}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-200 dark:border-zinc-700">
              <span className="text-stone-600 dark:text-zinc-400">Total Questions</span>
              <span className="font-semibold text-stone-900 dark:text-zinc-100">{stats.totalQuestions}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-200 dark:border-zinc-700">
              <span className="text-stone-600 dark:text-zinc-400">Publish Rate</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{publishRate}%</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-stone-600 dark:text-zinc-400">Needs Attention</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{stats.pending} pending</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

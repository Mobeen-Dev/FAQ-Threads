"use client";

import StatCard from "@/components/StatCard";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type AnalyticsData } from "@/services/shopifyApi";

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-stone-600 dark:text-zinc-400">{label}</span>
        <span className="font-medium text-stone-900 dark:text-zinc-100">{value}</span>
      </div>
      <div className="w-full bg-stone-200 dark:bg-zinc-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();

  const { data, loading, error } = useFetch<AnalyticsData>(
    () => shopifyApi.getAnalytics(),
    [user?.id]
  );

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  if (error) {
    return <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 p-4 rounded-xl">Error: {error}</div>;
  }

  const s = {
    totalQuestions: 0, published: 0, pending: 0, suspended: 0, categories: 0,
    totalAnswers: 0, publishedAnswers: 0, totalContributors: 0, trustedContributors: 0,
    ...data,
  };
  const publishRate = s.totalQuestions > 0 ? Math.round((s.published / s.totalQuestions) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mb-6">Analytics</h1>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total FAQs" value={s.totalQuestions} icon="📋" color="bg-teal-500" />
        <StatCard title="Published" value={s.published} icon="✅" color="bg-emerald-500" />
        <StatCard title="Publish Rate" value={`${publishRate}%`} icon="📊" color="bg-violet-500" />
        <StatCard title="Categories" value={s.categories} icon="📁" color="bg-sky-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Answers" value={s.totalAnswers} icon="💬" color="bg-sky-500" />
        <StatCard title="Published Answers" value={s.publishedAnswers} icon="📢" color="bg-emerald-500" />
        <StatCard title="Contributors" value={s.totalContributors} icon="👥" color="bg-teal-500" />
        <StatCard title="Trusted" value={s.trustedContributors} icon="⭐" color="bg-violet-500" />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Question Breakdown</h2>
          <div className="space-y-4">
            <BarRow label="Published" value={s.published} total={s.totalQuestions} color="bg-emerald-500" />
            <BarRow label="Pending" value={s.pending} total={s.totalQuestions} color="bg-amber-500" />
            <BarRow label="Suspended" value={s.suspended} total={s.totalQuestions} color="bg-orange-500" />
            <BarRow label="Other" value={Math.max(0, s.totalQuestions - s.published - s.pending - s.suspended)} total={s.totalQuestions} color="bg-stone-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-stone-200 dark:border-zinc-700">
              <span className="text-stone-600 dark:text-zinc-400">Publish Rate</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{publishRate}%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-200 dark:border-zinc-700">
              <span className="text-stone-600 dark:text-zinc-400">Answer Rate</span>
              <span className="font-semibold text-stone-900 dark:text-zinc-100">
                {s.totalAnswers > 0 ? Math.round((s.publishedAnswers / s.totalAnswers) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-200 dark:border-zinc-700">
              <span className="text-stone-600 dark:text-zinc-400">Trusted Contributors</span>
              <span className="font-semibold text-violet-600 dark:text-violet-400">
                {s.trustedContributors} / {s.totalContributors}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-stone-600 dark:text-zinc-400">Needs Attention</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {s.pending} pending, {s.suspended} suspended
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

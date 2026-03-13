"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type StoreContributor } from "@/services/shopifyApi";

const statusBadge: Record<string, string> = {
  active: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  suspended: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
};

export default function ContributorsPage() {
  const { user } = useAuth();
  const [contributors, setContributors] = useState<StoreContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const { contributors: list } = await shopifyApi.getContributors(params);
      setContributors(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const handleSuspend = async (id: string) => {
    await shopifyApi.suspendContributor(id);
    load();
  };

  const handleUnsuspend = async (id: string) => {
    await shopifyApi.unsuspendContributor(id);
    load();
  };

  const handleTrust = async (id: string, trusted: boolean) => {
    await shopifyApi.trustContributor(id, trusted);
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Contributors</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {contributors.length === 0 ? (
        <div className="text-center py-16 text-stone-500 dark:text-zinc-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-lg font-medium">No contributors yet</p>
          <p className="text-sm mt-1">Contributors are created when customers submit questions via webhooks.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 divide-y divide-stone-100 dark:divide-zinc-800">
          {contributors.map((c) => (
            <div key={c.id} className="p-5 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-sm shrink-0">
                {(c.name || c.email)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-stone-900 dark:text-zinc-100 truncate">
                    {c.name || c.email}
                  </p>
                  {c.trusted && (
                    <span className="text-xs px-2 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium">
                      ⭐ Trusted
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-500 dark:text-zinc-400 truncate">{c.email}</p>
                {c.phone && <p className="text-xs text-stone-400 dark:text-zinc-500">{c.phone}</p>}
                <div className="flex gap-3 mt-1 text-xs text-stone-400 dark:text-zinc-500">
                  <span>❓ {c._count?.questions ?? 0} questions</span>
                  <span>💬 {c._count?.answers ?? 0} answers</span>
                  <span>👍 {c._count?.votes ?? 0} votes</span>
                </div>
              </div>

              {/* Status */}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge[c.status] || statusBadge.active}`}>
                {c.status}
              </span>

              {/* Actions */}
              <div className="flex gap-2">
                {c.status === "active" ? (
                  <button
                    onClick={() => handleSuspend(c.id)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnsuspend(c.id)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    Unsuspend
                  </button>
                )}
                <button
                  onClick={() => handleTrust(c.id, !c.trusted)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                    c.trusted
                      ? "border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800"
                      : "border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  }`}
                >
                  {c.trusted ? "Untrust" : "⭐ Trust"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

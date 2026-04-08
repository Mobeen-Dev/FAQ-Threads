"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useFetch } from "@/hooks/useFetch";
import { shopifyApi, type Answer } from "@/services/shopifyApi";
import AssociatedProductCard from "@/components/AssociatedProductCard";
import MaterialIcon from "@/components/MaterialIcon";
import DateFilter, { type DateFilterValue, type DateRange } from "@/components/DateFilter";
import SortDropdown, { type SortOption } from "@/components/SortDropdown";
import { formatRelativeDate } from "@/utils/date";

const statusClasses: Record<string, string> = {
  published: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  pending: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  rejected: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  suspended: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

export default function AnswersPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [questionIdFilter, setQuestionIdFilter] = useState(searchParams.get("questionId") || "");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [editing, setEditing] = useState<Answer | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [saving, setSaving] = useState(false);
  const modalCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  // Build API params including date range and sorting (server-side filtering)
  const { data, loading, refetch } = useFetch<{ answers: Answer[] }>(
    () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (sortBy) params.sortBy = sortBy;
      if (dateRange?.startDate) params.fromDate = dateRange.startDate.toISOString();
      if (dateRange?.endDate) params.toDate = dateRange.endDate.toISOString();
      return shopifyApi.getAnswers(questionIdFilter || undefined, params);
    },
    [user?.id, statusFilter, questionIdFilter, search, sortBy, dateRange?.startDate?.getTime(), dateRange?.endDate?.getTime()]
  );

  // Data comes pre-filtered and sorted from the server
  const answers = data?.answers ?? [];

  const title = useMemo(() => {
    if (questionIdFilter) return "Answers for Question";
    return "Answers Review";
  }, [questionIdFilter]);

  const openEdit = (answer: Answer) => {
    setEditing(answer);
    setAnswerText(answer.answerText);
  };

  const closeEdit = () => {
    setEditing(null);
    setAnswerText("");
  };

  useEffect(() => {
    if (!editing) return;
    modalCloseButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEdit();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await shopifyApi.updateAnswer(id, { status });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update answer status");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await shopifyApi.updateAnswer(editing.id, { answerText });
      closeEdit();
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update answer");
    } finally {
      setSaving(false);
    }
  };

  const removeAnswer = async (id: string) => {
    if (!confirm("Delete this answer?")) return;
    try {
      await shopifyApi.deleteAnswer(id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete answer");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">{title}</h1>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search answers..."
            className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
          <input
            value={questionIdFilter}
            onChange={(e) => setQuestionIdFilter(e.target.value)}
            placeholder="Filter by question ID"
            className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <DateFilter
            value={dateFilter}
            dateRange={dateRange}
            onChange={(value, range) => {
              setDateFilter(value);
              setDateRange(range);
            }}
          />
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : answers.length === 0 ? (
          <div className="text-center py-16 text-stone-500 dark:text-zinc-400">
            <MaterialIcon name="chat_bubble" className="text-4xl mb-3 block" />
            <p className="text-lg font-medium">No answers found</p>
            <p className="text-sm mt-1">Adjust filters or wait for customer contributions.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-zinc-800">
            {answers.map((answer) => (
              <div key={answer.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {answer.question && (
                      <div className="mb-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">
                          Question Context
                        </p>
                        <p className="text-sm text-stone-900 dark:text-zinc-100">{answer.question.question}</p>
                        {(answer.question.product || answer.question.productTitle || answer.question.productHandle) && (
                          <div className="mt-3">
                            <AssociatedProductCard
                              product={answer.question.product}
                              productTitle={answer.question.productTitle}
                              productHandle={answer.question.productHandle}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-stone-900 dark:text-zinc-100">{answer.answerText}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300">
                        Score: {answer.voteScore}
                      </span>
                      {answer.createdAt && (
                        <span className="text-stone-500 dark:text-zinc-400">
                          {formatRelativeDate(answer.createdAt)}
                        </span>
                      )}
                      {answer.contributor && (
                        <span className="text-stone-500 dark:text-zinc-400">
                          by {answer.contributor.name || answer.contributor.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={answer.status}
                      onChange={(e) => updateStatus(answer.id, e.target.value)}
                      className={`text-xs border rounded-full px-3 py-1.5 font-medium ${statusClasses[answer.status] || statusClasses.pending}`}
                    >
                      <option value="published">Published</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <button
                      onClick={() => openEdit(answer)}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removeAnswer(answer.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeEdit}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-answer-title"
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-zinc-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 id="edit-answer-title" className="text-xl font-semibold text-stone-900 dark:text-zinc-100">Edit Answer</h2>
              <button
                ref={modalCloseButtonRef}
                onClick={closeEdit}
                aria-label="Close edit answer dialog"
                className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400"
              >
                <MaterialIcon name="close" className="text-[1.1rem]" />
              </button>
            </div>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={8}
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-2xl px-4 py-3 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={closeEdit}
                className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

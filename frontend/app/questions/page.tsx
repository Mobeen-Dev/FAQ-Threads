"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuestionForm from "@/components/QuestionForm";
import QuestionTable from "@/components/QuestionTable";
import AssociatedProductCard from "@/components/AssociatedProductCard";
import MaterialIcon from "@/components/MaterialIcon";
import DateFilter, { type DateFilterValue, type DateRange } from "@/components/DateFilter";
import SortDropdown, { type SortOption } from "@/components/SortDropdown";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type PaginatedResponse, type Question, type Category } from "@/services/shopifyApi";

export default function QuestionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [dateFilter, setDateFilter] = useState<DateFilterValue>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [saving, setSaving] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [openQuestion, setOpenQuestion] = useState<Question | null>(null);
  const [openingQuestion, setOpeningQuestion] = useState(false);
  const modalCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!openQuestionId) return;
    modalCloseButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenQuestionId(null);
        setOpenQuestion(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openQuestionId]);

  // Build API params including date range and sorting (server-side filtering)
  const { data: questionsData, loading, refetch } = useFetch<PaginatedResponse<Question>>(
    () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      if (sortBy) params.sortBy = sortBy;
      if (dateRange?.startDate) params.fromDate = dateRange.startDate.toISOString();
      if (dateRange?.endDate) params.toDate = dateRange.endDate.toISOString();
      return shopifyApi.getQuestions(params);
    },
    [user?.id, statusFilter, searchQuery, sortBy, dateRange?.startDate?.getTime(), dateRange?.endDate?.getTime()]
  );

  const { data: categoriesData, refetch: refetchCategories } = useFetch<{ categories: Category[] }>(
    () => shopifyApi.getCategories(),
    [user?.id]
  );

  // Data comes pre-filtered and sorted from the server
  const questions = questionsData?.questions ?? [];
  const categories = categoriesData?.categories ?? [];

  const handleCreate = async (data: { question: string; answer: string; categoryId?: string }) => {
    setSaving(true);
    try {
      await shopifyApi.createQuestion(data);
      setShowForm(false);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create question");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/questions/${id}`);
    setOpenQuestionId(null);
    setOpenQuestion(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await shopifyApi.deleteQuestion(id);
      if (openQuestionId === id) {
        setOpenQuestionId(null);
        setOpenQuestion(null);
      }
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await shopifyApi.updateQuestion(id, { status });
      refetch();
      if (openQuestionId === id) {
        setOpenQuestion((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleCreateCategory = async (name: string) => {
    try {
      const { category } = await shopifyApi.createCategory({ name });
      refetchCategories();
      return category;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create category");
      return null;
    }
  };

  const handleOpenQuestion = async (id: string) => {
    setOpenQuestionId(id);
    setOpeningQuestion(true);
    try {
      const { question } = await shopifyApi.getQuestion(id);
      setOpenQuestion(question);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load question details");
      setOpenQuestionId(null);
      setOpenQuestion(null);
    } finally {
      setOpeningQuestion(false);
    }
  };

  const openNewForm = () => {
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Questions</h1>
        <button
          onClick={openNewForm}
          className="bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-colors font-medium"
        >
          Add Question
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">
            New Question
          </h2>
          <QuestionForm
            key="new"
            categories={categories}
            onSubmit={handleCreate}
            onCancel={closeForm}
            onCreateCategory={handleCreateCategory}
            loading={saving}
          />
        </div>
      )}

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 flex-1 min-w-[200px] bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
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
          <option value="draft">Draft</option>
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

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : (
          <QuestionTable
            questions={questions}
            onOpen={handleOpenQuestion}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onViewAnswers={(id) => router.push(`/answers?questionId=${id}`)}
          />
        )}
      </div>

      {questionsData?.pagination && (
        <div className="mt-4 text-sm text-stone-500 dark:text-zinc-400 text-center">
          Showing {questions.length} of {questionsData.pagination.total} questions
          (Page {questionsData.pagination.page} of {questionsData.pagination.totalPages})
        </div>
      )}

      {openQuestionId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => {
            setOpenQuestionId(null);
            setOpenQuestion(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-details-title"
            className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {openingQuestion || !openQuestion ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h2 id="question-details-title" className="text-xl font-semibold text-stone-900 dark:text-zinc-100">{openQuestion.question}</h2>
                  <button
                    ref={modalCloseButtonRef}
                    onClick={() => {
                      setOpenQuestionId(null);
                      setOpenQuestion(null);
                    }}
                    aria-label="Close question details dialog"
                    className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400"
                  >
                    <MaterialIcon name="close" className="text-[1.1rem]" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-stone-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                    <p className="text-sm text-stone-600 dark:text-zinc-400 mb-1">Answer</p>
                    <p className="text-stone-900 dark:text-zinc-100 whitespace-pre-wrap">{openQuestion.answer || "No answer yet"}</p>
                  </div>

                  {(openQuestion.product || openQuestion.productTitle || openQuestion.productHandle) && (
                    <div className="bg-stone-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                      <p className="text-sm text-stone-600 dark:text-zinc-400 mb-2">Associated Product</p>
                      <AssociatedProductCard
                        product={openQuestion.product}
                        productTitle={openQuestion.productTitle}
                        productHandle={openQuestion.productHandle}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <select
                      value={openQuestion.status}
                      onChange={(e) => handleStatusChange(openQuestion.id, e.target.value)}
                      className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100"
                    >
                      <option value="published">Published</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                      <option value="draft">Draft</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300">
                      <span className="inline-flex items-center gap-1">
                        <MaterialIcon name="visibility" className="text-sm" />
                        {openQuestion.views} views
                      </span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
                      <span className="inline-flex items-center gap-1">
                        <MaterialIcon name="chat" className="text-sm" />
                        {openQuestion._count?.answers ?? 0} answers
                      </span>
                    </span>
                    {openQuestion.category?.name && (
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300">
                        {openQuestion.category.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => router.push(`/answers?questionId=${openQuestion.id}`)}
                      className="px-4 py-2.5 rounded-xl border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                    >
                      Review Answers
                    </button>
                    <button
                      onClick={() => handleEdit(openQuestion.id)}
                      className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
                    >
                      Edit Question
                    </button>
                    <button
                      onClick={() => handleDelete(openQuestion.id)}
                      className="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

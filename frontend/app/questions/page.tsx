"use client";

import { useState } from "react";
import QuestionForm from "@/components/QuestionForm";
import QuestionTable from "@/components/QuestionTable";
import { useFetch } from "@/hooks/useFetch";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type PaginatedResponse, type Question, type Category } from "@/services/shopifyApi";

export default function QuestionsPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    question: string;
    answer: string;
    categoryId?: string;
    status?: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: questionsData, loading, refetch } = useFetch<PaginatedResponse<Question>>(
    () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      return shopifyApi.getQuestions(params);
    },
    [user?.id, statusFilter, searchQuery]
  );

  const { data: categoriesData, refetch: refetchCategories } = useFetch<{ categories: Category[] }>(
    () => shopifyApi.getCategories(),
    [user?.id]
  );

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

  const handleUpdate = async (data: { question: string; answer: string; categoryId?: string; status?: string }) => {
    if (!editingId) return;
    setSaving(true);
    try {
      await shopifyApi.updateQuestion(editingId, data);
      setShowForm(false);
      setEditingId(null);
      setEditingData(null);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    try {
      const { question } = await shopifyApi.getQuestion(id);
      setEditingData({
        question: question.question,
        answer: question.answer,
        categoryId: question.categoryId || undefined,
        status: question.status,
      });
      setEditingId(id);
      setShowForm(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load question");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await shopifyApi.deleteQuestion(id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await shopifyApi.updateQuestion(id, { status });
      refetch();
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

  const openNewForm = () => {
    setEditingId(null);
    setEditingData(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingData(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Questions</h1>
        <button
          onClick={openNewForm}
          className="bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-colors font-medium"
        >
          + Add Question
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">
            {editingId ? "Edit Question" : "New Question"}
          </h2>
          <QuestionForm
            key={editingId || "new"}
            initialData={editingData || undefined}
            categories={categories}
            onSubmit={editingId ? handleUpdate : handleCreate}
            onCancel={closeForm}
            onCreateCategory={handleCreateCategory}
            loading={saving}
            isEditing={!!editingId}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 flex-1 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
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
      </div>

      {/* Question List */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : (
          <QuestionTable
            questions={questions}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onViewAnswers={(id) => { /* TODO: answer drawer */ }}
          />
        )}
      </div>

      {/* Pagination info */}
      {questionsData?.pagination && (
        <div className="mt-4 text-sm text-stone-500 dark:text-zinc-400 text-center">
          Showing {questions.length} of {questionsData.pagination.total} questions
          (Page {questionsData.pagination.page} of {questionsData.pagination.totalPages})
        </div>
      )}
    </div>
  );
}

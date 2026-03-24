"use client";

import { useState } from "react";

interface QuestionFormProps {
  initialData?: {
    question: string;
    answer: string;
    categoryId?: string;
    status?: string;
  };
  categories: { id: string; name: string }[];
  onSubmit: (data: { question: string; answer: string; categoryId?: string; status?: string }) => void;
  onCancel: () => void;
  onCreateCategory?: (name: string) => Promise<{ id: string; name: string } | null>;
  loading?: boolean;
  isEditing?: boolean;
}

export default function QuestionForm({
  initialData,
  categories,
  onSubmit,
  onCancel,
  onCreateCategory,
  loading = false,
  isEditing = false,
}: QuestionFormProps) {
  const [question, setQuestion] = useState(initialData?.question || "");
  const [answer, setAnswer] = useState(initialData?.answer || "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [status, setStatus] = useState(initialData?.status || "pending");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      question,
      answer,
      categoryId: categoryId || undefined,
      ...(isEditing ? { status } : {}),
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !onCreateCategory) return;
    setCreatingCategory(true);
    try {
      const cat = await onCreateCategory(newCategoryName.trim());
      if (cat) {
        setCategoryId(cat.id);
        setNewCategoryName("");
        setShowNewCategory(false);
      }
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
          Question
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
          placeholder="Enter the FAQ question..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
          Answer
        </label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={5}
          className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
          placeholder="Enter the answer..."
          required
        />
      </div>

      {/* Category with inline creation */}
      <div>
        <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
          Category
        </label>
        <div className="flex gap-2 items-center">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 border border-stone-300 dark:border-zinc-600 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewCategory(!showNewCategory)}
            className="px-4 py-3 rounded-xl border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors text-sm font-medium whitespace-nowrap"
          >
            {showNewCategory ? "Cancel" : "+ New"}
          </button>
        </div>

        {showNewCategory && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 border border-stone-300 dark:border-zinc-600 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
              placeholder="New category name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateCategory();
                }
              }}
            />
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={creatingCategory || !newCategoryName.trim()}
              className="px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {creatingCategory ? "Creating..." : "Create"}
            </button>
          </div>
        )}
      </div>

      {/* Status selector (only in edit mode) */}
      {isEditing && (
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-4 py-3 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
          >
            <option value="pending">Pending</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-teal-600 text-white px-6 py-3 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
        >
          {loading ? "Saving..." : isEditing ? "Update Question" : "Create Question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

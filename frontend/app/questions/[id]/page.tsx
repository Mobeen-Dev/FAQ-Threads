"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QuestionForm from "@/components/QuestionForm";
import AssociatedProductCard from "@/components/AssociatedProductCard";
import { shopifyApi, type Question, type Category } from "@/services/shopifyApi";

export default function QuestionEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [question, setQuestion] = useState<Question | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [{ question: fetchedQuestion }, { categories: fetchedCategories }] = await Promise.all([
          shopifyApi.getQuestion(id),
          shopifyApi.getCategories(),
        ]);
        if (!active) return;
        setQuestion(fetchedQuestion);
        setCategories(fetchedCategories);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to load question");
        router.push("/questions");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [id, router]);

  const handleCreateCategory = async (name: string) => {
    try {
      const { category } = await shopifyApi.createCategory({ name });
      const { categories: refreshed } = await shopifyApi.getCategories();
      setCategories(refreshed);
      return category;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create category");
      return null;
    }
  };

  const handleUpdate = async (data: { question: string; answer: string; categoryId?: string; status?: string }) => {
    if (!id) return;
    setSaving(true);
    try {
      const { question: updated } = await shopifyApi.updateQuestion(id, data);
      setQuestion(updated);
      router.push("/questions");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !question) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Edit Question</h1>
        <button
          onClick={() => router.push("/questions")}
          className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
        >
          Back to Questions
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <QuestionForm
            initialData={{
              question: question.question,
              answer: question.answer,
              categoryId: question.categoryId || undefined,
              status: question.status,
            }}
            categories={categories}
            onSubmit={handleUpdate}
            onCancel={() => router.push("/questions")}
            onCreateCategory={handleCreateCategory}
            loading={saving}
            isEditing
          />
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-zinc-100 mb-3">Question (Read-only)</h2>
          <div className="space-y-4">
            <div className="rounded-xl bg-stone-50 dark:bg-zinc-800/50 p-4">
              <p className="text-sm text-stone-600 dark:text-zinc-400 mb-1">Question</p>
              <p className="text-stone-900 dark:text-zinc-100 whitespace-pre-wrap">{question.question}</p>
            </div>

            <div className="rounded-xl bg-stone-50 dark:bg-zinc-800/50 p-4">
              <p className="text-sm text-stone-600 dark:text-zinc-400 mb-1">Current Answer</p>
              <p className="text-stone-900 dark:text-zinc-100 whitespace-pre-wrap">{question.answer || "No answer yet"}</p>
            </div>

            {(question.product || question.productTitle || question.productHandle) && (
              <div className="rounded-xl bg-stone-50 dark:bg-zinc-800/50 p-4">
                <p className="text-sm text-stone-600 dark:text-zinc-400 mb-2">Associated Product</p>
                <AssociatedProductCard
                  product={question.product}
                  productTitle={question.productTitle}
                  productHandle={question.productHandle}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

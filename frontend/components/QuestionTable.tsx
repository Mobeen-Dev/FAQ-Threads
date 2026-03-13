"use client";

import { useState, useRef, useEffect } from "react";

interface Question {
  id: string;
  question: string;
  answer: string;
  status: string;
  views: number;
  helpful: number;
  category?: { name: string } | null;
}

interface QuestionTableProps {
  questions: Question[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

const statusStyles: Record<string, { select: string; dot: string }> = {
  published: {
    select: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  pending: {
    select: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  rejected: {
    select: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
  },
  draft: {
    select: "bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 border-stone-200 dark:border-zinc-700",
    dot: "bg-stone-400 dark:bg-zinc-500",
  },
};

function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-500 dark:text-zinc-400 transition-colors"
        title="Actions"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="4.5" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="15.5" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-stone-200 dark:border-zinc-700 py-1 z-50">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-700 flex items-center gap-2.5 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.333 2A1.886 1.886 0 0114 4.667l-9 9-3.667 1L3.333 11l9-9z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2.5 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuestionTable({ questions, onEdit, onDelete, onStatusChange }: QuestionTableProps) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-16 text-stone-500 dark:text-zinc-400">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-lg font-medium">No questions yet</p>
        <p className="text-sm mt-1">Create your first FAQ question to get started.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100 dark:divide-zinc-800">
      {questions.map((q) => {
        const style = statusStyles[q.status] || statusStyles.draft;
        return (
          <div key={q.id} className="px-5 py-4 hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors">
            <div className="flex items-start gap-4">
              {/* Main content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-stone-900 dark:text-zinc-100 mb-1 line-clamp-1">
                  {q.question}
                </h3>
                <p className="text-sm text-stone-500 dark:text-zinc-400 line-clamp-2">
                  {q.answer}
                </p>
                <div className="flex items-center gap-3 mt-2.5">
                  {q.category?.name && (
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium">
                      {q.category.name}
                    </span>
                  )}
                  <span className="text-xs text-stone-400 dark:text-zinc-500">
                    👁 {q.views}
                  </span>
                  <span className="text-xs text-stone-400 dark:text-zinc-500">
                    👍 {q.helpful}
                  </span>
                </div>
              </div>

              {/* Status selector */}
              <div className="flex-shrink-0 relative">
                <div className={`flex items-center gap-1.5 rounded-full border px-1 ${style.select}`}>
                  <span className={`w-2 h-2 rounded-full ${style.dot} ml-1.5`} />
                  <select
                    value={q.status}
                    onChange={(e) => onStatusChange(q.id, e.target.value)}
                    className="text-xs font-medium py-1.5 pr-5 bg-transparent border-none outline-none cursor-pointer appearance-none"
                  >
                    <option value="published">Published</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                    <option value="draft">Draft</option>
                  </select>
                  <svg
                    className="w-3 h-3 -ml-4 mr-1.5 pointer-events-none opacity-60"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M3 5l3 3 3-3" />
                  </svg>
                </div>
              </div>

              {/* Actions menu */}
              <ActionMenu onEdit={() => onEdit(q.id)} onDelete={() => onDelete(q.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

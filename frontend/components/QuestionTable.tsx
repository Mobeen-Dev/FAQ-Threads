"use client";

import { useState, useRef, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { type Question } from "@/services/shopifyApi";
import { formatRelativeDate } from "@/utils/date";

interface QuestionTableProps {
  questions: Question[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onViewAnswers?: (id: string) => void;
}

interface CustomerContact {
  name: string;
  email: string | null;
  phoneNumber: string | null;
}

const WHATSAPP_MESSAGE = "Hi, I'm contacting you regarding your question.";
const EMAIL_SUBJECT = "Regarding your question";
const EMAIL_BODY = "Hi,\n\nI'm reaching out regarding your question.\n\nThanks.";

function normalizeWhatsAppNumber(phoneNumber: string | null | undefined) {
  if (!phoneNumber) return null;
  const trimmed = phoneNumber.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return null;
  return digits;
}

function getCustomerContact(question: Question): CustomerContact {
  return {
    name: question.customerName ?? question.contributor?.name ?? question.contributor?.email ?? "Unknown customer",
    email: question.email ?? question.customerEmail ?? question.contributor?.email ?? null,
    phoneNumber: question.phoneNumber ?? question.customerPhone ?? question.contributor?.phone ?? null,
  };
}

function buildMailtoLink(email: string | null) {
  if (!email) return null;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(EMAIL_SUBJECT)}&body=${encodeURIComponent(EMAIL_BODY)}`;
}

function buildWhatsAppLink(phoneNumber: string | null) {
  const normalizedPhone = normalizeWhatsAppNumber(phoneNumber);
  if (!normalizedPhone) return null;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
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
  suspended: {
    select: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        aria-label="Question actions"
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
            <MaterialIcon name="edit" className="text-base" />
            Edit
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2.5 transition-colors"
          >
            <MaterialIcon name="delete" className="text-base" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuestionTable({ questions, onOpen, onEdit, onDelete, onStatusChange, onViewAnswers }: QuestionTableProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerContact | null>(null);

  useEffect(() => {
    if (!selectedCustomer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCustomer(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedCustomer]);

  if (questions.length === 0) {
    return (
      <div className="text-center py-16 text-stone-500 dark:text-zinc-400">
        <MaterialIcon name="edit_note" className="text-4xl mb-3 block" />
        <p className="text-lg font-medium">No questions yet</p>
        <p className="text-sm mt-1">Create your first FAQ question to get started.</p>
      </div>
    );
  }

  const mailtoLink = selectedCustomer ? buildMailtoLink(selectedCustomer.email) : null;
  const whatsappLink = selectedCustomer ? buildWhatsAppLink(selectedCustomer.phoneNumber) : null;

  return (
    <>
      <div className="divide-y divide-stone-100 dark:divide-zinc-800">
        {questions.map((q) => {
          const style = statusStyles[q.status] || statusStyles.draft;
          const answerCount = q._count?.answers ?? 0;
          const customer = getCustomerContact(q);
          return (
            <div
              key={q.id}
              onClick={() => onOpen(q.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(q.id);
                }
              }}
              className="px-5 py-4 hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-4">
                {/* Vote score */}
                <div className="flex flex-col items-center min-w-[40px] pt-0.5">
                  <span className={`text-lg font-bold ${q.voteScore > 0 ? "text-teal-600 dark:text-teal-400" : q.voteScore < 0 ? "text-rose-500" : "text-stone-400 dark:text-zinc-500"}`}>
                    {q.voteScore > 0 ? `+${q.voteScore}` : q.voteScore}
                  </span>
                  <span className="text-[10px] text-stone-400 dark:text-zinc-500 uppercase tracking-wide">votes</span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-900 dark:text-zinc-100 mb-1 line-clamp-1">
                    {q.question}
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-zinc-400 line-clamp-2">
                    {q.answer || <span className="italic">No answer yet</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    {q.category?.name && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium">
                        {q.category.name}
                      </span>
                    )}
                    {q.contributor?.trusted && (
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium">
                        Trusted
                      </span>
                    )}
                    <span className="text-xs text-stone-400 dark:text-zinc-500 inline-flex items-center gap-1">
                      <MaterialIcon name="visibility" className="text-sm" />
                      {q.views}
                    </span>
                    {answerCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewAnswers?.(q.id);
                        }}
                        aria-label={`View answers for question ${q.question}`}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
                      >
                        <MaterialIcon name="chat" className="text-sm" />
                        {answerCount} {answerCount === 1 ? "answer" : "answers"}
                      </button>
                    )}
                    {q.createdAt && (
                      <span className="text-xs text-stone-400 dark:text-zinc-500">
                        {formatRelativeDate(q.createdAt)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCustomer(customer);
                      }}
                      aria-label={`Open contact details for ${customer.name}`}
                      className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline inline-flex items-center gap-1"
                    >
                      <MaterialIcon name="person" className="text-sm" />
                      {customer.name}
                    </button>
                  </div>
                </div>

                {/* Status selector */}
                <div className="flex-shrink-0 relative">
                  <div className={`flex items-center gap-1.5 rounded-full border px-1 ${style.select}`}>
                    <span className={`w-2 h-2 rounded-full ${style.dot} ml-1.5`} />
                    <select
                      value={q.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onStatusChange(q.id, e.target.value)}
                      className="text-xs font-medium py-1.5 pr-5 bg-transparent border-none outline-none cursor-pointer appearance-none"
                    >
                      <option value="published">Published</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                      <option value="draft">Draft</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    <svg className="w-3 h-3 -ml-4 mr-1.5 pointer-events-none opacity-60" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-contact-title"
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <h2 id="customer-contact-title" className="text-lg font-semibold text-stone-900 dark:text-zinc-100">
                Customer Contact
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Close customer contact popup"
                className="w-9 h-9 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400"
              >
                <MaterialIcon name="close" className="text-[1.1rem]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-stone-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">Customer Name</p>
                <p className="text-sm text-stone-900 dark:text-zinc-100 break-words">{selectedCustomer.name}</p>
              </div>

              <div className="bg-stone-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">Email Address</p>
                <p className="text-sm text-stone-900 dark:text-zinc-100 break-words mb-3">{selectedCustomer.email || "Not available"}</p>
                {mailtoLink ? (
                  <a
                    href={mailtoLink}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <MaterialIcon name="mail" className="text-base" />
                    Send Email
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-200 dark:bg-zinc-700 text-stone-500 dark:text-zinc-400 text-sm font-medium cursor-not-allowed"
                  >
                    <MaterialIcon name="mail" className="text-base" />
                    Send Email
                  </button>
                )}
              </div>

              <div className="bg-stone-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-1">Phone Number</p>
                <p className="text-sm text-stone-900 dark:text-zinc-100 break-words mb-3">{selectedCustomer.phoneNumber || "Not available"}</p>
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <MaterialIcon name="chat" className="text-base" />
                    Chat on WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-200 dark:bg-zinc-700 text-stone-500 dark:text-zinc-400 text-sm font-medium cursor-not-allowed"
                  >
                    <MaterialIcon name="chat" className="text-base" />
                    Chat on WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

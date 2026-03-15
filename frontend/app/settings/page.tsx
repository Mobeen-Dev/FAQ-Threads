"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type Settings } from "@/services/shopifyApi";

type PublishingMode = "manual" | "auto" | "time";

function Toggle({ value, onChange, label, description }: {
  value: boolean; onChange: (v: boolean) => void; label: string; description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-stone-900 dark:text-zinc-100">{label}</p>
        <p className="text-sm text-stone-500 dark:text-zinc-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${value ? "bg-teal-600" : "bg-stone-300 dark:bg-zinc-600"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${value ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
}

function NumberInput({ value, onChange, label, min = 0, max = 9999 }: {
  value: number; onChange: (v: number) => void; label: string; min?: number; max?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        min={min}
        max={max}
        className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-5 text-stone-900 dark:text-zinc-100">{title}</h2>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function ModeSelector({
  title,
  value,
  onChange,
}: {
  title: string;
  value: PublishingMode;
  onChange: (mode: PublishingMode) => void;
}) {
  const modes: Array<{ id: PublishingMode; label: string; description: string }> = [
    { id: "manual", label: "Manual review", description: "Requires admin approval before publishing" },
    { id: "auto", label: "Auto publish", description: "Publishes immediately on submit" },
    { id: "time", label: "Time-based", description: "Publishes automatically after configured delay" },
  ];

  return (
    <div>
      <p className="text-sm font-medium text-stone-700 dark:text-zinc-300 mb-2">{title}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {modes.map((mode) => {
          const active = value === mode.id;
          return (
            <button
              type="button"
              key={mode.id}
              onClick={() => onChange(mode.id)}
              className={`text-left rounded-2xl border p-3 transition-colors ${
                active
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"
                  : "border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-zinc-800"
              }`}
            >
              <p className="font-medium">{mode.label}</p>
              <p className="text-xs mt-1 opacity-80">{mode.description}</p>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-stone-500 dark:text-zinc-400 mt-2">Only one mode can be active at a time.</p>
    </div>
  );
}

const DEFAULTS: Settings = {
  widgetEnabled: true,
  widgetPosition: "bottom-right",
  primaryColor: "#0d9488",
  allowSubmission: true,
  notifyEmail: null,
  autoPublishQuestions: false,
  manualPublishQuestions: true,
  publishQuestionsAfterTimeEnabled: false,
  publishQuestionsAfterMinutes: 0,
  publishQuestionsAfterHours: 24,
  autoPublishAnswers: false,
  manualPublishAnswers: true,
  publishAnswersAfterTimeEnabled: false,
  publishAnswersAfterMinutes: 0,
  publishAnswersAfterHours: 24,
  autoPublishIfAnswersLessThan: 0,
  autoModeration: false,
  trustedCustomerAutoPublish: false,
};

function getQuestionMode(settings: Settings): PublishingMode {
  if (settings.autoPublishQuestions) return "auto";
  if (settings.publishQuestionsAfterTimeEnabled) return "time";
  return "manual";
}

function getAnswerMode(settings: Settings): PublishingMode {
  if (settings.autoPublishAnswers) return "auto";
  if (settings.publishAnswersAfterTimeEnabled) return "time";
  return "manual";
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const { settings: data } = await shopifyApi.getSettings();
      setSettings({ ...DEFAULTS, ...data });
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadSettings();
  }, [user, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { settings: data } = await shopifyApi.updateSettings(settings);
      setSettings({ ...DEFAULTS, ...data });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const setQuestionMode = (mode: PublishingMode) => {
    setSettings((prev) => ({
      ...prev,
      autoPublishQuestions: mode === "auto",
      manualPublishQuestions: mode === "manual",
      publishQuestionsAfterTimeEnabled: mode === "time",
    }));
  };

  const setAnswerMode = (mode: PublishingMode) => {
    setSettings((prev) => ({
      ...prev,
      autoPublishAnswers: mode === "auto",
      manualPublishAnswers: mode === "manual",
      publishAnswersAfterTimeEnabled: mode === "time",
    }));
  };

  const questionMode = getQuestionMode(settings);
  const answerMode = getAnswerMode(settings);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-600 text-white px-5 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl mb-6">
          ✅ Settings saved successfully!
        </div>
      )}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl mb-6">
          ❌ {error}
        </div>
      )}

      <Section title="FAQ Widget">
        <Toggle value={settings.widgetEnabled} onChange={(v) => update("widgetEnabled", v)}
          label="Enable Widget" description="Show the FAQ widget on your storefront" />
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Widget Position</label>
          <select value={settings.widgetPosition} onChange={(e) => update("widgetPosition", e.target.value)}
            className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none">
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="inline">Inline (embedded)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={settings.primaryColor} onChange={(e) => update("primaryColor", e.target.value)}
              className="w-10 h-10 rounded-xl border border-stone-300 dark:border-zinc-600 cursor-pointer" />
            <input type="text" value={settings.primaryColor} onChange={(e) => update("primaryColor", e.target.value)}
              className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 w-32 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100" />
          </div>
        </div>
        <Toggle value={settings.allowSubmission} onChange={(v) => update("allowSubmission", v)}
          label="Allow Customer Submissions" description="Let customers submit new questions from the storefront" />
      </Section>

      <Section title="Question Publishing">
        <ModeSelector title="Question publishing mode" value={questionMode} onChange={setQuestionMode} />
        {questionMode === "time" && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-teal-200 dark:border-teal-800">
            <NumberInput value={settings.publishQuestionsAfterHours} onChange={(v) => update("publishQuestionsAfterHours", v)}
              label="Hours delay" min={0} max={720} />
            <NumberInput value={settings.publishQuestionsAfterMinutes} onChange={(v) => update("publishQuestionsAfterMinutes", v)}
              label="Minutes delay" min={0} max={59} />
          </div>
        )}
      </Section>

      <Section title="Answer Publishing">
        <ModeSelector title="Answer publishing mode" value={answerMode} onChange={setAnswerMode} />
        {answerMode === "time" && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-teal-200 dark:border-teal-800">
            <NumberInput value={settings.publishAnswersAfterHours} onChange={(v) => update("publishAnswersAfterHours", v)}
              label="Hours delay" min={0} max={720} />
            <NumberInput value={settings.publishAnswersAfterMinutes} onChange={(v) => update("publishAnswersAfterMinutes", v)}
              label="Minutes delay" min={0} max={59} />
          </div>
        )}
      </Section>

      <Section title="Moderation & Trust">
        <Toggle value={settings.autoModeration} onChange={(v) => update("autoModeration", v)}
          label="Auto-Moderation" description="Use automated moderation rules for content filtering" />
        <Toggle value={settings.trustedCustomerAutoPublish} onChange={(v) => update("trustedCustomerAutoPublish", v)}
          label="Trusted Customer Auto-Publish" description="Auto-publish content from customers marked as trusted" />
      </Section>

      <Section title="Notifications">
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Notification Email</label>
          <input type="email" value={settings.notifyEmail || ""} onChange={(e) => update("notifyEmail", e.target.value || null)}
            placeholder="you@example.com"
            className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
          <p className="text-sm text-stone-500 dark:text-zinc-400 mt-1">Receive email notifications for new submissions</p>
        </div>
      </Section>
    </div>
  );
}

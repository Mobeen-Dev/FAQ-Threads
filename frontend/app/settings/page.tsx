"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type Settings } from "@/services/shopifyApi";

function Toggle({ value, onChange, label, description }: {
  value: boolean; onChange: (v: boolean) => void; label: string; description: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-stone-900 dark:text-zinc-100">{label}</p>
        <p className="text-sm text-stone-500 dark:text-zinc-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          value ? "bg-teal-600" : "bg-stone-300 dark:bg-zinc-600"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
          value ? "translate-x-6" : ""
        }`} />
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

      {/* Widget Settings */}
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

      {/* Question Publishing Rules */}
      <Section title="Question Publishing">
        <Toggle value={settings.autoPublishQuestions} onChange={(v) => update("autoPublishQuestions", v)}
          label="Auto-Publish Questions" description="Immediately publish new questions without review" />
        <Toggle value={settings.manualPublishQuestions} onChange={(v) => update("manualPublishQuestions", v)}
          label="Manual Review" description="Require manual approval before publishing (default)" />
        <Toggle value={settings.publishQuestionsAfterTimeEnabled} onChange={(v) => update("publishQuestionsAfterTimeEnabled", v)}
          label="Time-Based Publishing" description="Auto-publish questions after a delay if not reviewed" />
        {settings.publishQuestionsAfterTimeEnabled && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-teal-200 dark:border-teal-800">
            <NumberInput value={settings.publishQuestionsAfterHours} onChange={(v) => update("publishQuestionsAfterHours", v)}
              label="Hours" min={0} max={720} />
            <NumberInput value={settings.publishQuestionsAfterMinutes} onChange={(v) => update("publishQuestionsAfterMinutes", v)}
              label="Minutes" min={0} max={59} />
          </div>
        )}
      </Section>

      {/* Answer Publishing Rules */}
      <Section title="Answer Publishing">
        <Toggle value={settings.autoPublishAnswers} onChange={(v) => update("autoPublishAnswers", v)}
          label="Auto-Publish Answers" description="Immediately publish new answers without review" />
        <Toggle value={settings.manualPublishAnswers} onChange={(v) => update("manualPublishAnswers", v)}
          label="Manual Review" description="Require manual approval before publishing answers" />
        <Toggle value={settings.publishAnswersAfterTimeEnabled} onChange={(v) => update("publishAnswersAfterTimeEnabled", v)}
          label="Time-Based Publishing" description="Auto-publish answers after a delay if not reviewed" />
        {settings.publishAnswersAfterTimeEnabled && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-teal-200 dark:border-teal-800">
            <NumberInput value={settings.publishAnswersAfterHours} onChange={(v) => update("publishAnswersAfterHours", v)}
              label="Hours" min={0} max={720} />
            <NumberInput value={settings.publishAnswersAfterMinutes} onChange={(v) => update("publishAnswersAfterMinutes", v)}
              label="Minutes" min={0} max={59} />
          </div>
        )}
        <NumberInput value={settings.autoPublishIfAnswersLessThan} onChange={(v) => update("autoPublishIfAnswersLessThan", v)}
          label="Auto-publish if published answers less than (0 = disabled)" min={0} max={100} />
      </Section>

      {/* Moderation & Trust */}
      <Section title="Moderation & Trust">
        <Toggle value={settings.autoModeration} onChange={(v) => update("autoModeration", v)}
          label="Auto-Moderation" description="Use automated moderation rules for content filtering" />
        <Toggle value={settings.trustedCustomerAutoPublish} onChange={(v) => update("trustedCustomerAutoPublish", v)}
          label="Trusted Customer Auto-Publish" description="Auto-publish content from customers marked as trusted" />
      </Section>

      {/* Notifications */}
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

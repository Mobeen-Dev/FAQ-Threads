"use client";

import { useState } from "react";

interface Settings {
  widgetEnabled: boolean;
  widgetPosition: string;
  primaryColor: string;
  autoModeration: boolean;
  allowSubmission: boolean;
  notifyEmail: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    widgetEnabled: true,
    widgetPosition: "bottom-right",
    primaryColor: "#0d9488",
    autoModeration: false,
    allowSubmission: true,
    notifyEmail: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    // TODO: Save to API
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl mb-6">
          ✅ Settings saved successfully!
        </div>
      )}

      {/* FAQ Widget Settings */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">FAQ Widget</h2>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-zinc-100">Enable Widget</p>
              <p className="text-sm text-stone-500 dark:text-zinc-400">Show the FAQ widget on your storefront</p>
            </div>
            <button
              onClick={() => update("widgetEnabled", !settings.widgetEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.widgetEnabled ? "bg-teal-600" : "bg-stone-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  settings.widgetEnabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Widget Position</label>
            <select
              value={settings.widgetPosition}
              onChange={(e) => update("widgetPosition", e.target.value)}
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="inline">Inline (embedded)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                className="w-10 h-10 rounded-xl border border-stone-300 dark:border-zinc-600 cursor-pointer"
              />
              <input
                type="text"
                value={settings.primaryColor}
                onChange={(e) => update("primaryColor", e.target.value)}
                className="border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 w-32 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Moderation Settings */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Moderation</h2>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-zinc-100">Auto-Moderation</p>
              <p className="text-sm text-stone-500 dark:text-zinc-400">Automatically publish new questions without review</p>
            </div>
            <button
              onClick={() => update("autoModeration", !settings.autoModeration)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.autoModeration ? "bg-teal-600" : "bg-stone-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  settings.autoModeration ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-zinc-100">Allow Customer Submissions</p>
              <p className="text-sm text-stone-500 dark:text-zinc-400">Let customers submit new questions from the storefront</p>
            </div>
            <button
              onClick={() => update("allowSubmission", !settings.allowSubmission)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.allowSubmission ? "bg-teal-600" : "bg-stone-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  settings.allowSubmission ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">Notifications</h2>
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Notification Email</label>
          <input
            type="email"
            value={settings.notifyEmail}
            onChange={(e) => update("notifyEmail", e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
          <p className="text-sm text-stone-500 dark:text-zinc-400 mt-1">
            Receive email notifications when customers submit new questions
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type ShopCredentials } from "@/services/shopifyApi";
import { useRouter } from "next/navigation";

export default function CredentialsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [storeName, setStoreName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    shopifyApi.getCredentials().then((data: ShopCredentials) => {
      if (data.shop) {
        setDomain(data.shop.domain);
        setApiKey(data.shop.apiKey || "");
        setStoreName(data.shop.name || "");
        setHasExisting(true);
      }
      setWebhookUrl(data.webhookUrl);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, authLoading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const data = await shopifyApi.saveCredentials({
        domain,
        apiKey: apiKey || undefined,
        accessToken: accessToken || undefined,
        name: storeName || undefined,
      });
      setWebhookUrl(data.webhookUrl);
      setHasExisting(true);
      setAccessToken("");
      setSuccess("Credentials saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mb-6">Shopify Credentials</h1>

      {/* Webhook URL Card */}
      {webhookUrl && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-teal-900 dark:text-teal-100 mb-2">📡 Your Webhook URL</h2>
          <p className="text-sm text-teal-700 dark:text-teal-300 mb-3">
            Paste this URL in your Shopify app or Chrome extension. It accepts POST and PUT requests.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-zinc-800 border border-teal-300 dark:border-teal-700 rounded-xl px-4 py-2.5 text-sm font-mono text-teal-900 dark:text-teal-100 break-all">
              {webhookUrl}
            </code>
            <button
              onClick={copyWebhookUrl}
              className="bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition-colors text-sm whitespace-nowrap font-medium"
            >
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl mb-6">{error}</div>}
      {success && <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl mb-6">✅ {success}</div>}

      {/* Credentials Form */}
      <form onSubmit={handleSave} autoComplete="off" className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold mb-4 text-stone-900 dark:text-zinc-100">
          {hasExisting ? "Update Store Credentials" : "Connect Your Shopify Store"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">
              Store Domain <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="mystore.myshopify.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">API Key</label>
            <input
              type="text"
              name="shopify_api_key_field"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="Your Shopify API key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">
              Access Token {hasExisting && <span className="text-stone-400 dark:text-zinc-500">(leave blank to keep current)</span>}
            </label>
            <input
              type="text"
              name="shopify_access_token_field"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              autoComplete="off"
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="shpat_xxxxxxxxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Store Name</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="My Awesome Store"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving}
            className="bg-teal-600 text-white px-6 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : hasExisting ? "Update Credentials" : "Save Credentials"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type McpRotateResponse, type McpTokenStatus } from "@/services/shopifyApi";

type ToolId = "claude-desktop" | "cursor" | "vscode-copilot";

type ToolGuide = {
  id: ToolId;
  name: string;
  summary: string;
  configLocation: string;
  steps: string[];
  snippetTitle: string;
};

const BASE_URL_EXAMPLE = "https://your-domain.com/api/mcp/c/YOUR_MCP_CLIENT_KEY";
const TOKEN_EXAMPLE = "mcp_your_rotated_token";
const MCP_CREDENTIALS_STORAGE_KEY = "faq:mcp:latest-credentials:v1";

const DEFAULT_STATUS: McpTokenStatus = {
  tokenConfigured: false,
  tokenCreatedAt: null,
  clientKeyConfigured: false,
  clientKeyCreatedAt: null,
};

function buildConfigSnippet(apiBaseUrl: string, token: string) {
  return `{
  "mcpServers": {
    "faq-backend-operations": {
      "command": "npx",
      "args": ["-y", "@faq-app/agent-operation@latest"],
      "env": {
        "FAQ_MCP_API_BASE_URL": "${apiBaseUrl}",
        "FAQ_MCP_TOKEN": "${token}"
      }
    }
  }
}`;
}

function maskSecret(value: string, prefix = 12, suffix = 6) {
  if (!value || value.includes("YOUR_")) return value;
  if (value.length <= prefix + suffix) return `${value.slice(0, 4)}••••`;
  return `${value.slice(0, prefix)}••••••${value.slice(-suffix)}`;
}

function maskApiBaseUrl(value: string) {
  if (!value || value.includes("YOUR_")) return value;
  return value.replace(/\/c\/([^/]+)(\/|$)/, (_match, key, trailing) => `/c/${maskSecret(key, 8, 5)}${trailing}`);
}

const tools: ToolGuide[] = [
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    summary: "Attach your custom FAQ MCP server inside Claude Desktop.",
    configLocation: "Claude Desktop config (mcpServers)",
    steps: [
      "Open Claude Desktop MCP settings.",
      "Paste the copied MCP config JSON.",
      "Save and restart Claude Desktop.",
      "Verify faq-backend-operations is connected.",
    ],
    snippetTitle: "Claude Desktop MCP config",
  },
  {
    id: "cursor",
    name: "Cursor",
    summary: "Configure Cursor to call your custom FAQ MCP tools.",
    configLocation: "Cursor MCP config JSON",
    steps: [
      "Open Cursor MCP settings.",
      "Paste the copied MCP config JSON.",
      "Save and reload Cursor.",
      "Confirm MCP tools appear in AI tool list.",
    ],
    snippetTitle: "Cursor MCP config",
  },
  {
    id: "vscode-copilot",
    name: "VS Code (via Copilot)",
    summary: "Use Copilot MCP support with your FAQ backend operations server.",
    configLocation: "VS Code Copilot MCP config",
    steps: [
      "Open MCP configuration in VS Code Copilot.",
      "Paste the copied MCP config JSON.",
      "Reload VS Code.",
      "Confirm faq-backend-operations is available.",
    ],
    snippetTitle: "VS Code Copilot MCP config",
  },
];

export default function McpIntegrationClient() {
  const { user } = useAuth();
  const [selectedToolId, setSelectedToolId] = useState<ToolId>("claude-desktop");
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<McpTokenStatus>(DEFAULT_STATUS);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [rotateError, setRotateError] = useState("");
  const [rotateSuccess, setRotateSuccess] = useState("");
  const [showSensitiveValues, setShowSensitiveValues] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [credentials, setCredentials] = useState<McpRotateResponse | null>(null);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? tools[0],
    [selectedToolId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(MCP_CREDENTIALS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as McpRotateResponse;
      if (parsed?.token && parsed?.mcpApiBaseUrl) {
        setCredentials(parsed);
      }
    } catch {
      // Ignore invalid cached values.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadStatus = async () => {
      setLoadingStatus(true);
      setStatusError("");
      try {
        const response = await shopifyApi.getMcpTokenStatus();
        if (!active) return;
        setTokenStatus(response);
      } catch (error) {
        if (!active) return;
        setStatusError(error instanceof Error ? error.message : "Failed to load MCP credential status.");
      } finally {
        if (active) setLoadingStatus(false);
      }
    };

    loadStatus();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!showRotateConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowRotateConfirm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRotateConfirm]);

  const displayApiBase = credentials?.mcpApiBaseUrl ?? BASE_URL_EXAMPLE;
  const displayToken = credentials?.token ?? TOKEN_EXAMPLE;
  const displayConfigSnippet = buildConfigSnippet(
    showSensitiveValues ? displayApiBase : maskApiBaseUrl(displayApiBase),
    showSensitiveValues ? displayToken : maskSecret(displayToken, 10, 6)
  );
  const copyReadyConfigSnippet = buildConfigSnippet(displayApiBase, displayToken);
  const canCopyReadyValues = Boolean(credentials?.mcpApiBaseUrl && credentials?.token);
  const hasSessionCredentials = canCopyReadyValues;
  const hasConfiguredCredentials = tokenStatus.tokenConfigured && tokenStatus.clientKeyConfigured;
  const requiresFirstTimeGeneration =
    !loadingStatus && !statusError && !hasConfiguredCredentials && !hasSessionCredentials;

  const handleCopy = async (snippetId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSnippetId(snippetId);
      window.setTimeout(() => {
        setCopiedSnippetId((prev) => (prev === snippetId ? null : prev));
      }, 2000);
    } catch {
      setCopiedSnippetId(null);
    }
  };

  const rotateCredentials = async (isFirstGeneration: boolean) => {
    setRotating(true);
    setRotateError("");
    setRotateSuccess("");
    try {
      const response = await shopifyApi.rotateMcpToken();
      setCredentials(response);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(MCP_CREDENTIALS_STORAGE_KEY, JSON.stringify(response));
      }
      setTokenStatus({
        tokenConfigured: true,
        tokenCreatedAt: response.createdAt,
        clientKeyConfigured: true,
        clientKeyCreatedAt: response.createdAt,
      });
      setShowRotateConfirm(false);
      setCopiedSnippetId(null);
      setRotateSuccess(
        isFirstGeneration
          ? "MCP credentials generated successfully. Setup is now ready."
          : "MCP credentials rotated. Previous MCP connections are now invalid and must be updated."
      );
    } catch (error) {
      setRotateError(error instanceof Error ? error.message : "Failed to rotate MCP credentials.");
      setShowRotateConfirm(false);
    } finally {
      setRotating(false);
    }
  };

  const handleGenerateCredentials = async () => {
    await rotateCredentials(true);
  };

  const handleRotateConfirm = async () => {
    await rotateCredentials(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">MCP Integration</h1>
        <p className="text-stone-600 dark:text-zinc-400 mt-1">
          Connect your AI tool to your custom FAQ MCP backend.
        </p>
      </div>

      {requiresFirstTimeGeneration && (
        <section className="mb-6">
          <div className="rounded-3xl bg-zinc-950 text-zinc-100 border border-zinc-800 p-8 md:p-10">
            <h2 className="text-2xl font-semibold">Initialize MCP Credentials</h2>
            <p className="text-zinc-300 text-sm mt-3 max-w-2xl">
              This is a one-click user action to start MCP integration. After generating credentials, this page will
              show setup instructions and copy-ready config.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 text-sm">
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                <p className="font-medium">Generate</p>
                <p className="text-zinc-400 mt-1">Create token and client key.</p>
              </div>
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                <p className="font-medium">Copy</p>
                <p className="text-zinc-400 mt-1">Use ready config JSON in your tool.</p>
              </div>
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
                <p className="font-medium">Connect</p>
                <p className="text-zinc-400 mt-1">Reload and use MCP operations.</p>
              </div>
            </div>

            {statusError && <p className="text-sm text-rose-300 mt-5">{statusError}</p>}
            {rotateError && <p className="text-sm text-rose-300 mt-2">{rotateError}</p>}

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGenerateCredentials}
                disabled={rotating}
                className="inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <MaterialIcon name="vpn_key" className={`text-base ${rotating ? "animate-spin" : ""}`} />
                {rotating ? "Generating..." : "Generate MCP Credentials"}
              </button>
            </div>

            <p className="text-xs text-zinc-400 mt-6">
              By continuing, you agree to our{" "}
              <Link href="/compliance/mcp" className="text-teal-400 hover:underline">
                MCP Compliance & Terms
              </Link>
              .
            </p>
          </div>
        </section>
      )}

      {!requiresFirstTimeGeneration && (
        <>
          <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-zinc-100">MCP Credentials</h2>

              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowSensitiveValues((prev) => !prev)}
                  className="inline-flex items-center gap-2 border border-stone-300 dark:border-zinc-700 px-3 py-2 rounded-xl text-sm text-stone-700 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <MaterialIcon name={showSensitiveValues ? "visibility_off" : "visibility"} className="text-base" />
                  {showSensitiveValues ? "Hide sensitive values" : "Show sensitive values"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRotateConfirm(true)}
                  disabled={rotating}
                  className="inline-flex items-center gap-2 bg-teal-600 text-white px-3 py-2 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors text-sm"
                >
                  <MaterialIcon name="sync" className={`text-base ${rotating ? "animate-spin" : ""}`} />
                  {rotating ? "Rotating..." : "Rotate Keys"}
                </button>
              </div>
            </div>

            {loadingStatus && (
              <div className="mt-4 flex items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500" />
                Loading MCP status...
              </div>
            )}

            {!loadingStatus && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-stone-600 dark:text-zinc-400">
                  <span className="font-medium">Credential status:</span>{" "}
                  {tokenStatus.tokenConfigured && tokenStatus.clientKeyConfigured
                    ? "Configured"
                    : "Not configured"}
                </p>
                {statusError && (
                  <p className="text-sm text-rose-700 dark:text-rose-300">{statusError}</p>
                )}
                {rotateError && (
                  <p className="text-sm text-rose-700 dark:text-rose-300">{rotateError}</p>
                )}
                {rotateSuccess && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">{rotateSuccess}</p>
                )}
                {!canCopyReadyValues && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Rotate keys once to generate real copy-ready credentials for this session.
                  </p>
                )}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-3">
                Supported Tools
              </h2>
              <div className="space-y-2">
                {tools.map((tool) => {
                  const isSelected = selectedTool.id === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setSelectedToolId(tool.id)}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                        isSelected
                          ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300"
                          : "border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-zinc-800"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <p className="font-medium">{tool.name}</p>
                      <p className="text-xs mt-1 opacity-80">{tool.summary}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-6">
              <article className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-stone-900 dark:text-zinc-100">{selectedTool.name}</h2>
                <p className="text-stone-600 dark:text-zinc-400 mt-1">{selectedTool.summary}</p>
                <p className="text-sm text-stone-500 dark:text-zinc-400 mt-3">
                  <span className="font-medium">Config location:</span> {selectedTool.configLocation}
                </p>

                <ol className="mt-5 space-y-3 text-stone-700 dark:text-zinc-300">
                  {selectedTool.steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </article>

              <article className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-stone-900 dark:text-zinc-100">{selectedTool.snippetTitle}</h3>
                  <button
                    type="button"
                    onClick={() => handleCopy("tool-config", copyReadyConfigSnippet)}
                    disabled={!canCopyReadyValues}
                    className="inline-flex items-center gap-2 bg-teal-600 text-white px-3 py-2 rounded-xl hover:bg-teal-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MaterialIcon name={copiedSnippetId === "tool-config" ? "check" : "content_copy"} className="text-base" />
                    {copiedSnippetId === "tool-config" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl p-4 text-xs overflow-x-auto text-stone-800 dark:text-zinc-200">
                  {displayConfigSnippet}
                </pre>
                {!canCopyReadyValues && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    Rotate keys to enable copy-ready config with live credentials.
                  </p>
                )}
              </article>

              <p className="text-sm text-stone-600 dark:text-zinc-400">
                All actions on this tab follow MCP compliance requirements. Review{" "}
                <Link href="/compliance/mcp" className="text-teal-600 dark:text-teal-400 hover:underline">
                  MCP Compliance & Responsibility
                </Link>
                .
              </p>
            </section>
          </div>
        </>
      )}

      {showRotateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-zinc-100">Rotate MCP credentials?</h2>
            <p className="text-sm text-stone-600 dark:text-zinc-400 mt-2">
              If you continue, all previous MCP connections will immediately stop working until they are updated with
              the new credentials.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
              This action invalidates existing token/client-key pairs.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowRotateConfirm(false)}
                className="px-4 py-2 rounded-xl border border-stone-300 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRotateConfirm}
                disabled={rotating}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {rotating ? "Rotating..." : "Yes, rotate now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

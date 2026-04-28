"use client";

import { useMemo, useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";

type ToolId = "claude-desktop" | "cursor" | "vscode-copilot";

type ToolGuide = {
  id: ToolId;
  name: string;
  summary: string;
  configLocation: string;
  steps: string[];
  snippets: Array<{
    id: string;
    title: string;
    code: string;
  }>;
};

const BASE_URL_EXAMPLE = "https://your-domain.com/api/mcp/c/YOUR_MCP_CLIENT_KEY";
const TOKEN_EXAMPLE = "mcp_your_rotated_token";

const CLAUDE_CONFIG_SNIPPET = `{
  "mcpServers": {
    "faq-backend-operations": {
      "command": "npx",
      "args": ["-y", "@faq-app/agent-operation@latest"],
      "env": {
        "FAQ_MCP_API_BASE_URL": "${BASE_URL_EXAMPLE}",
        "FAQ_MCP_TOKEN": "${TOKEN_EXAMPLE}"
      }
    }
  }
}`;

const CURSOR_CONFIG_SNIPPET = `{
  "mcpServers": {
    "faq-backend-operations": {
      "command": "npx",
      "args": ["-y", "@faq-app/agent-operation@latest"],
      "env": {
        "FAQ_MCP_API_BASE_URL": "${BASE_URL_EXAMPLE}",
        "FAQ_MCP_TOKEN": "${TOKEN_EXAMPLE}"
      }
    }
  }
}`;

const VSCODE_CONFIG_SNIPPET = `{
  "mcpServers": {
    "faq-backend-operations": {
      "command": "npx",
      "args": ["-y", "@faq-app/agent-operation@latest"],
      "env": {
        "FAQ_MCP_API_BASE_URL": "${BASE_URL_EXAMPLE}",
        "FAQ_MCP_TOKEN": "${TOKEN_EXAMPLE}"
      }
    }
  }
}`;

const tools: ToolGuide[] = [
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    summary: "Attach your custom FAQ MCP server inside Claude Desktop.",
    configLocation: "Claude Desktop config (mcpServers)",
    steps: [
      "Rotate MCP credentials from your backend dashboard/API to get a fresh token and client key.",
      "Open Claude Desktop settings and edit the MCP config JSON file.",
      "Add the faq-backend-operations server block under mcpServers using your base URL and token.",
      "Save and restart Claude Desktop, then confirm the server is connected in MCP tools.",
    ],
    snippets: [
      {
        id: "claude-config",
        title: "Claude Desktop MCP config",
        code: CLAUDE_CONFIG_SNIPPET,
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    summary: "Configure Cursor to call your custom FAQ MCP tools.",
    configLocation: "Cursor MCP config JSON",
    steps: [
      "Generate or rotate MCP credentials so you have a current token and client-key URL.",
      "Open Cursor MCP settings and create or edit the MCP config file.",
      "Paste the faq-backend-operations entry with your FAQ_MCP_API_BASE_URL and FAQ_MCP_TOKEN values.",
      "Reload Cursor and verify MCP tools appear in your AI tool list.",
    ],
    snippets: [
      {
        id: "cursor-config",
        title: "Cursor MCP config",
        code: CURSOR_CONFIG_SNIPPET,
      },
    ],
  },
  {
    id: "vscode-copilot",
    name: "VS Code (via Copilot)",
    summary: "Use Copilot MCP support with your FAQ backend operations server.",
    configLocation: "VS Code MCP config (workspace or user-level)",
    steps: [
      "Rotate credentials in your FAQ backend and copy the returned token and client-key API base URL.",
      "Open MCP configuration in VS Code Copilot (workspace or user scope).",
      "Add faq-backend-operations under mcpServers with npx @faq-app/agent-operation.",
      "Reload VS Code and check Copilot tools to confirm MCP server registration.",
    ],
    snippets: [
      {
        id: "vscode-config",
        title: "VS Code Copilot MCP config",
        code: VSCODE_CONFIG_SNIPPET,
      },
    ],
  },
];

export default function McpIntegrationClient() {
  const [selectedToolId, setSelectedToolId] = useState<ToolId>("claude-desktop");
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? tools[0],
    [selectedToolId]
  );

  const handleCopy = async (snippetId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippetId(snippetId);
      window.setTimeout(() => {
        setCopiedSnippetId((prev) => (prev === snippetId ? null : prev));
      }, 2000);
    } catch {
      setCopiedSnippetId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">MCP Integration</h1>
        <p className="text-stone-600 dark:text-zinc-400 mt-1">
          Choose a client tool to see setup steps and copy-ready configuration for your custom MCP.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400 mb-3">Supported Tools</h2>
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

          {selectedTool.snippets.map((snippet) => {
            const copied = copiedSnippetId === snippet.id;
            return (
              <article
                key={snippet.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-stone-900 dark:text-zinc-100">{snippet.title}</h3>
                  <button
                    type="button"
                    onClick={() => handleCopy(snippet.id, snippet.code)}
                    className="inline-flex items-center gap-2 bg-teal-600 text-white px-3 py-2 rounded-xl hover:bg-teal-700 transition-colors text-sm"
                  >
                    <MaterialIcon name={copied ? "check" : "content_copy"} className="text-base" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl p-4 text-xs overflow-x-auto text-stone-800 dark:text-zinc-200">
                  {snippet.code}
                </pre>
              </article>
            );
          })}

          <article className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">Opt-out</h3>
            <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
              Set <code>NEXT_PUBLIC_ENABLE_MCP_INTEGRATION=false</code> in frontend environment variables and redeploy to hide this feature.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}

export default function McpCompliancePage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100 mb-4">
        MCP Compliance & Responsibility
      </h1>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 space-y-4">
        <p className="text-stone-700 dark:text-zinc-300">
          This MCP integration is a user-configured connection layer. You are solely responsible for how credentials
          are generated, shared, stored, and used in external tools.
        </p>
        <p className="text-stone-700 dark:text-zinc-300">
          Any action executed through connected MCP clients, including data access and answer submission, is initiated
          under your account context and remains your responsibility.
        </p>
        <p className="text-stone-700 dark:text-zinc-300">
          Rotating MCP credentials invalidates previous connections immediately. Ensure all authorized integrations are
          updated after each rotation.
        </p>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          By using this feature, you acknowledge that outcomes produced by external AI tools are user-driven and must
          be reviewed and governed by your own internal compliance policies.
        </p>
      </div>
    </div>
  );
}

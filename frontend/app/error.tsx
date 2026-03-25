"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <span className="material-symbols-rounded text-6xl text-red-500 mb-4">
          error
        </span>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          An unexpected error occurred. Please try again or contact support if the
          problem persists.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <details className="mb-6 text-left bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
              Error details
            </summary>
            <pre className="mt-2 text-xs text-red-600 dark:text-red-300 overflow-auto">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

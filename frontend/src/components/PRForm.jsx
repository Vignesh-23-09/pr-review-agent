import { useState } from 'react';

export default function PRForm({ onSubmit, disabled, error, onReset, showReset }) {
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">Review a Pull Request</h2>
      <p className="text-slate-500 text-sm mb-4">
        Paste a public GitHub PR URL and the agent will review the diff, flag issues, and suggest fixes.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          disabled={disabled}
          className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
            placeholder:text-slate-400"
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={disabled || !url.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
              text-white text-sm font-medium rounded-lg transition-colors
              disabled:cursor-not-allowed whitespace-nowrap"
          >
            {disabled ? (
              <span className="flex items-center gap-2">
                <Spinner /> Analysing…
              </span>
            ) : (
              'Review PR'
            )}
          </button>
          {showReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700
                text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              New review
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Only public GitHub PRs are supported. Processing typically takes 20–90 seconds depending on PR size.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}

import FindingCard from './FindingCard.jsx';

const STATUS_LABELS = {
  queued: 'Waiting in queue…',
  fetching: 'Fetching PR from GitHub…',
  reviewing: 'Reviewing with Gemini…',
  completed: 'Review complete',
  failed: 'Review failed',
};

const STATUS_COLORS = {
  queued: 'text-slate-500',
  fetching: 'text-blue-600',
  reviewing: 'text-violet-600',
  completed: 'text-green-600',
  failed: 'text-red-600',
};

const VERDICT_CONFIG = {
  approve: {
    label: '✅ Approve',
    cls: 'bg-green-100 text-green-800 border-green-200',
  },
  approve_with_nits: {
    label: '✏️ Approve with nits',
    cls: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  request_changes: {
    label: '🔄 Request changes',
    cls: 'bg-red-100 text-red-800 border-red-200',
  },
};

function StatusRow({ status, isPolling }) {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || 'text-slate-500';

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${color}`}>
      {isPolling && status !== 'completed' && status !== 'failed' && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      )}
      {label}
    </div>
  );
}

function PRMeta({ pr }) {
  if (!pr?.title) return null;
  return (
    <div className="mb-4">
      <a
        href={pr.pr_url}
        target="_blank"
        rel="noreferrer"
        className="text-base font-semibold text-blue-700 hover:underline"
      >
        {pr.title}
      </a>
      <p className="text-sm text-slate-500 mt-0.5">
        {pr.owner}/{pr.repo} #{pr.number}
        {pr.files_changed != null && (
          <span className="ml-2">
            · {pr.files_changed} files · +{pr.additions} −{pr.deletions}
          </span>
        )}
      </p>
    </div>
  );
}

function SeverityCount({ findings }) {
  const counts = { blocker: 0, major: 0, minor: 0, info: 0 };
  findings.forEach((f) => { if (counts[f.severity] !== undefined) counts[f.severity]++; });

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {[['blocker', 'text-red-600'], ['major', 'text-orange-600'], ['minor', 'text-yellow-600'], ['info', 'text-blue-500']].map(
        ([sev, cls]) =>
          counts[sev] > 0 && (
            <span key={sev} className={`font-medium ${cls}`}>
              {counts[sev]} {sev}
            </span>
          )
      )}
      {Object.values(counts).every((c) => c === 0) && (
        <span className="text-slate-500">No issues found</span>
      )}
    </div>
  );
}

export default function ReviewResult({ review }) {
  const { status, pr, result, error } = review;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <PRMeta pr={pr} />
        <StatusRow status={status} isPolling={false} />
      </div>

      {status === 'failed' && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-700">
          <p className="font-semibold mb-1">Review failed</p>
          <p>{error.message}</p>
        </div>
      )}

      {status === 'completed' && result && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Verdict</p>
                {VERDICT_CONFIG[result.verdict] && (
                  <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold border ${VERDICT_CONFIG[result.verdict].cls}`}>
                    {VERDICT_CONFIG[result.verdict].label}
                  </span>
                )}
              </div>
              {result.stats && (
                <div className="text-xs text-slate-400 text-right">
                  <p>{result.stats.files_reviewed} files reviewed · {result.stats.files_skipped} skipped</p>
                  <p>{result.stats.model_calls} model calls · {(result.stats.duration_ms / 1000).toFixed(1)}s</p>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
          </div>

          {result.findings?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">Findings</h3>
                <SeverityCount findings={result.findings} />
              </div>
              <div className="space-y-3">
                {result.findings.map((finding, i) => (
                  <FindingCard key={i} finding={finding} />
                ))}
              </div>
            </div>
          )}

          {result.findings?.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-semibold text-green-800">No issues found</p>
              <p className="text-sm text-green-700 mt-1">This PR looks good to go!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SEVERITY_STYLES = {
  blocker: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700',
    bg: 'bg-red-50',
    icon: '🔴',
  },
  major: {
    border: 'border-l-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    bg: 'bg-orange-50',
    icon: '🟠',
  },
  minor: {
    border: 'border-l-yellow-500',
    badge: 'bg-yellow-100 text-yellow-700',
    bg: 'bg-yellow-50',
    icon: '🟡',
  },
  info: {
    border: 'border-l-blue-400',
    badge: 'bg-blue-100 text-blue-700',
    bg: 'bg-blue-50',
    icon: '🔵',
  },
};

const CATEGORY_LABELS = {
  bug: 'Bug',
  security: 'Security',
  performance: 'Performance',
  error_handling: 'Error Handling',
  maintainability: 'Maintainability',
  testing: 'Testing',
  style: 'Style',
};

export default function FindingCard({ finding }) {
  const styles = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info;

  return (
    <div className={`rounded-lg border border-slate-200 border-l-4 ${styles.border} overflow-hidden`}>
      <div className={`px-4 py-3 ${styles.bg} flex flex-wrap items-center gap-2`}>
        <span className="text-sm">{styles.icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${styles.badge}`}>
          {finding.severity}
        </span>
        <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
          {CATEGORY_LABELS[finding.category] || finding.category}
        </span>
        <code className="text-xs font-mono text-slate-600 ml-auto">
          {finding.file}{finding.line ? `:${finding.line}` : ''}
        </code>
      </div>

      <div className="px-4 py-3 bg-white">
        <p className="text-sm text-slate-800 leading-relaxed">{finding.comment}</p>

        {finding.suggested_fix && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Suggested fix</p>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {finding.suggested_fix}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

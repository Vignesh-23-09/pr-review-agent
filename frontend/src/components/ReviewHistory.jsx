import { useEffect, useState } from 'react';

const VERDICT_CONFIG = {
  approve: { label: 'Approve', cls: 'bg-green-100 text-green-700' },
  approve_with_nits: { label: 'Nits', cls: 'bg-yellow-100 text-yellow-700' },
  request_changes: { label: 'Changes', cls: 'bg-red-100 text-red-700' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReviewHistory({ apiBase = '', onSelect, refreshTrigger }) {
  const [history, setHistory] = useState([]);

  async function load() {
    try {
      const res = await fetch(`${apiBase}/api/v1/reviews`);
      if (res.ok) setHistory(await res.json());
    } catch {}
  }

  useEffect(() => { load(); }, [refreshTrigger]);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-sm text-slate-700">Review History</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {history.map((r) => {
          const verdict = VERDICT_CONFIG[r.result?.verdict];
          return (
            <li key={r.review_id}>
              <button
                onClick={() => onSelect(r.review_id)}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {r.pr?.title || `${r.pr?.owner}/${r.pr?.repo} #${r.pr?.number}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.pr?.owner}/{r.pr?.repo} #{r.pr?.number} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'failed' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Failed</span>
                  ) : verdict ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${verdict.cls}`}>
                      {verdict.label}
                    </span>
                  ) : null}
                  {r.result?.stats && (
                    <span className="text-xs text-slate-400">{r.result.stats.files_reviewed}f</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

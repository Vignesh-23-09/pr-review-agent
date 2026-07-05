import { useState } from 'react';
import PRForm from './components/PRForm.jsx';
import ReviewResult from './components/ReviewResult.jsx';
import ReviewHistory from './components/ReviewHistory.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function App() {
  const [phase, setPhase] = useState('idle'); // idle | loading | done | error
  const [review, setReview] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  async function handleSubmit(prUrl) {
    setSubmitError(null);
    setReview(null);
    setPhase('loading');

    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr_url: prUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error?.message || 'Failed to submit review');
        setPhase('error');
        return;
      }
      setReview(data);
      setPhase('done');
      setHistoryRefresh((n) => n + 1);
    } catch (err) {
      setSubmitError(err.message);
      setPhase('error');
    }
  }

  async function handleSelectHistory(reviewId) {
    setSubmitError(null);
    setPhase('done');
    try {
      const res = await fetch(`${API_BASE}/api/v1/reviews/${reviewId}`);
      const data = await res.json();
      setReview(data);
    } catch (err) {
      setSubmitError(err.message);
    }
  }

  function handleReset() {
    setPhase('idle');
    setReview(null);
    setSubmitError(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <div>
            <h1 className="text-xl font-bold leading-tight">PR Review Agent</h1>
            <p className="text-slate-400 text-sm">AI-powered code review for public GitHub pull requests</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-4">
        <PRForm
          onSubmit={handleSubmit}
          disabled={phase === 'loading'}
          error={submitError}
          onReset={handleReset}
          showReset={phase === 'done' || phase === 'error'}
        />

        {phase === 'done' && review && (
          <ReviewResult review={review} />
        )}

        <ReviewHistory
          apiBase={API_BASE}
          onSelect={handleSelectHistory}
          refreshTrigger={historyRefresh}
        />
      </main>
    </div>
  );
}

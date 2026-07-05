const Review = require('../models/Review');
const { fetchPR, fetchFiles } = require('./github');
const { reviewBatch, synthesize } = require('./gemini');

const CHARS_PER_TOKEN = 4;
const BATCH_TOKEN_BUDGET = 120_000;
const BATCH_CHAR_BUDGET = BATCH_TOKEN_BUDGET * CHARS_PER_TOKEN;

function estimateFileChars(file) {
  return (file.patch?.length || 0) + (file.fullContent?.length || 0);
}

function batchFiles(files) {
  const batches = [];
  let current = [];
  let currentChars = 0;

  for (const file of files) {
    const size = estimateFileChars(file);
    if (current.length > 0 && currentChars + size > BATCH_CHAR_BUDGET) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(file);
    currentChars += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function severityRank(s) {
  return { blocker: 0, major: 1, minor: 2, info: 3 }[s] ?? 4;
}

function deriveBaseVerdict(findings) {
  if (findings.some((f) => f.severity === 'blocker' || f.severity === 'major')) {
    return 'request_changes';
  }
  if (findings.some((f) => f.severity === 'minor')) return 'approve_with_nits';
  return 'approve';
}

async function setStatus(review, status) {
  review.status = status;
  if (status === 'fetching' || status === 'reviewing') review.started_at = review.started_at || new Date();
  await review.save();
}

async function runReview(reviewId) {
  const review = await Review.findOne({ review_id: reviewId });
  if (!review) return;

  const startedAt = Date.now();
  let modelCalls = 0;

  try {
    await setStatus(review, 'fetching');

    const prData = await fetchPR(review.pr.owner, review.pr.repo, review.pr.number);
    Object.assign(review.pr, prData);
    review.cache_key = `${prData.owner}/${prData.repo}/${prData.number}/${prData.head_sha}`;
    await review.save();

    const { files, skipped } = await fetchFiles(
      prData.owner, prData.repo, prData.number, prData.head_sha
    );

    await setStatus(review, 'reviewing');

    const batches = batchFiles(files);
    const prContext = {
      owner: prData.owner,
      repo: prData.repo,
      title: prData.title,
      description: prData.description,
    };

    const batchResults = await Promise.all(
      batches.map(async (batch) => {
        const findings = await reviewBatch(prContext, batch);
        modelCalls++;
        return findings;
      })
    );

    const allFindings = batchResults.flat().sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.file.localeCompare(b.file)
    );

    const synthesis = await synthesize(prContext, allFindings);
    modelCalls++;

    const baseVerdict = deriveBaseVerdict(allFindings);
    const verdictOrder = { request_changes: 0, approve_with_nits: 1, approve: 2 };
    const finalVerdict =
      verdictOrder[synthesis.verdict] <= verdictOrder[baseVerdict]
        ? synthesis.verdict
        : baseVerdict;

    review.status = 'completed';
    review.finished_at = new Date();
    review.result = {
      verdict: finalVerdict,
      summary: synthesis.summary,
      findings: allFindings,
      stats: {
        files_reviewed: files.length,
        files_skipped: skipped.length,
        model_calls: modelCalls,
        duration_ms: Date.now() - startedAt,
      },
    };
    await review.save();
  } catch (err) {
    console.error(`Review ${reviewId} failed:`, err.message);
    review.status = 'failed';
    review.finished_at = new Date();
    review.error = { code: err.code || 'upstream_error', message: err.message };
    await review.save();
  }
}

module.exports = { runReview };

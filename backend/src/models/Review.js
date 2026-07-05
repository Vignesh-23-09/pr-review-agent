const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  file: { type: String, required: true },
  line: { type: Number, default: null },
  severity: { type: String, enum: ['blocker', 'major', 'minor', 'info'], required: true },
  category: {
    type: String,
    enum: ['bug', 'security', 'performance', 'error_handling', 'maintainability', 'testing', 'style'],
    required: true,
  },
  comment: { type: String, required: true },
  suggested_fix: { type: String, default: null },
});

const reviewResultSchema = new mongoose.Schema({
  verdict: { type: String, enum: ['approve', 'approve_with_nits', 'request_changes'] },
  summary: String,
  findings: [findingSchema],
  stats: {
    files_reviewed: Number,
    files_skipped: Number,
    model_calls: Number,
    duration_ms: Number,
  },
});

const reviewSchema = new mongoose.Schema(
  {
    review_id: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'fetching', 'reviewing', 'completed', 'failed'],
      default: 'queued',
    },
    pr: {
      owner: String,
      repo: String,
      number: Number,
      title: String,
      description: String,
      head_sha: String,
      base_sha: String,
      files_changed: Number,
      additions: Number,
      deletions: Number,
      pr_url: String,
    },
    focus: [String],
    cache_key: { type: String, index: true },
    result: { type: reviewResultSchema, default: null },
    error: {
      code: String,
      message: String,
    },
    started_at: Date,
    finished_at: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);

const express = require('express');
const { randomUUID } = require('crypto');
const Review = require('../models/Review');
const { parsePRUrl } = require('../services/github');
const { runReview } = require('../services/pipeline');

const router = express.Router();

router.post('/', async (req, res) => {
  const { pr_url, focus } = req.body || {};
  if (!pr_url || typeof pr_url !== 'string') {
    return res.status(400).json({ error: { code: 'invalid_pr_url', message: 'pr_url is required' } });
  }

  let parsed;
  try {
    parsed = parsePRUrl(pr_url.trim());
  } catch (err) {
    return res.status(400).json({ error: { code: err.code || 'invalid_pr_url', message: err.message } });
  }

  const review_id = `rev_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

  const review = new Review({
    review_id,
    status: 'queued',
    pr: { ...parsed, pr_url: pr_url.trim() },
    focus: Array.isArray(focus) ? focus : [],
  });

  await review.save();
  await runReview(review_id);

  const completed = await Review.findOne({ review_id }).lean();
  res.status(200).json(completed);
});

router.get('/', async (req, res) => {
  const reviews = await Review.find(
    { status: { $in: ['completed', 'failed'] } },
    { review_id: 1, status: 1, pr: 1, 'result.verdict': 1, 'result.stats': 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(reviews);
});

router.get('/:id', async (req, res) => {
  const review = await Review.findOne({ review_id: req.params.id }).lean();
  if (!review) {
    return res.status(404).json({ error: { code: 'review_not_found', message: 'Review not found' } });
  }
  res.json(review);
});

module.exports = router;

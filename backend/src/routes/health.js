const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const router = express.Router();

router.get('/', async (req, res) => {
  const dbOk = mongoose.connection.readyState === 1;

  let githubOk = false;
  try {
    await axios.get('https://api.github.com', { timeout: 5000 });
    githubOk = true;
  } catch {}

  const geminiKeySet = Boolean(process.env.GEMINI_API_KEY);

  const ok = dbOk && githubOk && geminiKeySet;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    checks: { mongodb: dbOk, github: githubOk, gemini_key_set: geminiKeySet },
  });
});

module.exports = router;

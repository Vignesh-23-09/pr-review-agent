const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pr_agent';

let connected = false;

async function connectDB() {
  if (connected || mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGODB_URI);
  connected = true;
}

const express = require('express');
const cors = require('cors');
const reviewsRouter = require('./routes/reviews');
const healthRouter = require('./routes/health');

const app = express();

app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: { code: 'db_unavailable', message: 'Database connection failed' } });
  }
});

app.use('/api/v1/reviews', reviewsRouter);
app.use('/healthz', healthRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error', message: err.message } });
});

module.exports = app;

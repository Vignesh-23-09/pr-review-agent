# PR Review Agent

An AI-powered code review tool that automatically reviews GitHub pull requests and provides structured feedback — bugs, security issues, performance concerns, and more.

## What it does

Paste a public GitHub PR URL → get a detailed code review with:
- Per-finding breakdown (file, line, severity, category, suggested fix)
- Overall verdict: `approve`, `approve_with_nits`, or `request_changes`
- A written summary of the PR quality

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB (via Mongoose) |
| AI Model | Gemini 3.1 Flash Lite (fallback: Gemini 2.5 Flash Lite) |
| GitHub API | REST API via Axios |
| Deployment | Vercel (frontend + backend as serverless functions) |

## Project Structure

```
pr-agent/
├── frontend/          # React app
│   └── src/
│       ├── App.jsx
│       └── components/
├── backend/           # Express API
│   ├── api/index.js   # Vercel serverless entry
│   └── src/
│       ├── app.js
│       ├── routes/reviews.js
│       ├── models/Review.js
│       └── services/
│           ├── github.js
│           ├── gemini.js
│           └── pipeline.js
```

## Running Locally

### Backend

```bash
cd backend
cp .env.example .env   # fill in GEMINI_API_KEY, GITHUB_TOKEN, MONGODB_URI
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env   # set VITE_API_BASE=http://localhost:3000
npm install
npm run dev
```

## Environment Variables

### Backend `.env`
```
GEMINI_API_KEY=your_gemini_api_key
GITHUB_TOKEN=your_github_token
MONGODB_URI=mongodb://localhost:27017/pr_agent
```

### Frontend `.env`
```
VITE_API_BASE=https://your-backend.vercel.app
```

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/reviews` | Submit a PR for review |
| GET | `/api/v1/reviews` | List past reviews |
| GET | `/api/v1/reviews/:id` | Get a specific review |
| GET | `/healthz` | Health check |

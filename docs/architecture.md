# PR Review Agent — Architecture & Tech Stack

This document explains how the project is built, how it works end-to-end, and where it can be improved. Written for someone who can explain this confidently in an interview.

---

## What the project does

A user pastes a GitHub Pull Request URL into a web app. The system fetches the PR's changed files, sends them to an AI model for review, stores the results in a database, and shows a structured review — findings with severity levels, affected lines, and suggested fixes.

---

## High-Level Architecture

```
User (Browser)
    |
    | paste PR URL
    v
Frontend (React + Vite)
    |
    | POST /api/v1/reviews
    v
Backend (Node.js + Express) — hosted on Vercel as a serverless function
    |
    |---> GitHub REST API   (fetch PR metadata + file diffs + full file content)
    |
    |---> Gemini AI API     (send diffs, get structured JSON review back)
    |
    |---> MongoDB           (save and retrieve review results)
    |
    v
Response back to frontend → displayed to user
```

---

## Tech Stack — Every Piece Explained

### Frontend

| Technology | Why |
|---|---|
| **React 18** | Component-based UI library by Meta. Makes it easy to build interactive interfaces that update when data changes. |
| **Vite** | Build tool and dev server. Much faster than the old Create React App. |
| **Tailwind CSS** | Utility-first CSS framework. You style by adding class names like `text-red-500` directly in JSX instead of writing separate CSS files. |

The frontend has three main components:
- `PRForm` — input box where the user pastes the PR URL
- `ReviewResult` — displays the verdict, summary, and individual findings
- `ReviewHistory` — shows a list of past reviews fetched from the backend

### Backend

| Technology | Why |
|---|---|
| **Node.js** | JavaScript runtime that runs on the server. Chosen because it handles many requests at once efficiently (non-blocking I/O). |
| **Express** | Minimal web framework for Node.js. Handles routing (which code runs for which URL). |
| **Axios** | HTTP client used to make requests to the GitHub API. |
| **dotenv** | Loads secret keys from a `.env` file so they're not hardcoded in the source code. |

### Database

| Technology | Why |
|---|---|
| **MongoDB** | A NoSQL database that stores data as JSON-like documents instead of rows and tables. Good fit here because each review result has a flexible, nested structure (findings array inside a review). |
| **Mongoose** | An ODM (Object Document Mapper) for MongoDB in Node.js. Lets you define schemas (shapes) for your data and interact with the database using JavaScript objects. |

#### What gets stored in MongoDB

Each review is saved as a document with this shape:

```
Review {
  review_id: "rev_abc123",
  status: "completed",          // queued → fetching → reviewing → completed/failed
  pr: {
    owner, repo, number,
    title, description,
    head_sha, base_sha,
    files_changed, additions, deletions
  },
  result: {
    verdict: "request_changes",
    summary: "...",
    findings: [
      {
        file: "src/auth.js",
        line: 42,
        severity: "blocker",
        category: "security",
        comment: "...",
        suggested_fix: "..."
      }
    ],
    stats: { files_reviewed, files_skipped, model_calls, duration_ms }
  }
}
```

### AI — Gemini

| Technology | Why |
|---|---|
| **Gemini 3.1 Flash Lite** | Google's AI model. Fast and cheap. Used as the primary model. |
| **Gemini 2.5 Flash Lite** | Fallback model if the primary is unavailable (503 error). |
| **@google/generative-ai** | Google's official Node.js SDK to call Gemini. |

The model is asked to respond in **structured JSON** (not free-form text) so the backend can reliably parse findings without any string manipulation.

### Deployment

| Technology | Why |
|---|---|
| **Vercel** | Cloud platform that deploys the frontend as a static site and the backend as serverless functions. Free tier available. |

---

## How a PR Review is Processed — Step by Step

This is the most important part to understand. Trace the code through `pipeline.js`, `github.js`, and `gemini.js`.

### Step 1 — User submits PR URL

The frontend sends:
```
POST /api/v1/reviews
{ "pr_url": "https://github.com/owner/repo/pull/123" }
```

The backend:
1. Parses the URL to extract `owner`, `repo`, `number`
2. Creates a `Review` document in MongoDB with `status: "queued"`
3. Immediately starts `runReview()` — no background queue, it runs inline

### Step 2 — Fetch PR metadata from GitHub

Status changes to `"fetching"`.

The backend calls the GitHub REST API:
- `GET /repos/{owner}/{repo}/pulls/{number}` — gets title, description, SHA of the head commit
- `GET /repos/{owner}/{repo}/pulls/{number}/files` — gets list of all changed files with their diffs (patches)

**Filtering:** Not all files are worth reviewing. The system skips:
- Deleted files
- Lock files (`package-lock.json`, `yarn.lock`, etc.)
- Binary/generated files (images, fonts, minified JS)
- Files without a diff patch

**Prioritization:** Modified files and files with more changes are reviewed first. Max 50 files.

**Full file content:** For each reviewable file, the backend also fetches the full file content at the head commit (not just the diff) so the AI has context around the changes.

### Step 3 — Batch files and send to Gemini

Status changes to `"reviewing"`.

Large PRs can have many files. Sending everything in one request would exceed the AI model's input limit. So the system **batches** files:
- Each batch is capped at ~120,000 tokens worth of content
- Multiple batches are sent to Gemini **in parallel** using `Promise.all()`

For each batch, the prompt tells the AI:
- What the PR is about (title, description)
- The diff for each file
- The full file content for context
- Exactly what format to respond in (JSON schema with `findings` array)

Gemini responds with structured JSON:
```json
{
  "findings": [
    {
      "file": "src/auth.js",
      "line": 42,
      "severity": "blocker",
      "category": "security",
      "comment": "User input is directly interpolated into SQL query — SQL injection risk.",
      "suggested_fix": "Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [userId])"
    }
  ]
}
```

### Step 4 — Synthesis

After all batches complete, all findings are merged and sorted (blockers first, then major, minor, info).

A second call to Gemini is made — the **synthesis step**. It receives the full list of findings and produces:
- A `verdict`: `approve`, `approve_with_nits`, or `request_changes`
- A `summary`: 3-5 sentences explaining the overall quality of the PR

The backend also independently computes a verdict from the findings (if there's any blocker/major finding → `request_changes`). If the AI's verdict is stricter than the computed one, the AI's verdict wins.

### Step 5 — Save and respond

The final result is saved to MongoDB and returned to the frontend in the same HTTP response.

### Retry and Fallback logic

If Gemini returns a `503 Service Unavailable` error:
- Retry up to 3 times with delays: 2s → 5s → 10s
- If still failing, automatically switch to `gemini-2.5-flash-lite` (fallback model)

---

## Severity Levels

| Level | Meaning |
|---|---|
| `blocker` | Must fix before merging — correctness bug, security hole, data loss risk |
| `major` | Significant design flaw or likely defect |
| `minor` | Real issue but low risk — fix soon |
| `info` | Observation or optional improvement |

## Finding Categories

`bug`, `security`, `performance`, `error_handling`, `maintainability`, `testing`, `style`

---

## Data Flow Diagram

```
Browser
  │
  │ 1. POST /api/v1/reviews { pr_url }
  ▼
Express Route (reviews.js)
  │
  │ 2. Parse URL, create Review in MongoDB (status: queued)
  │
  ▼
pipeline.js: runReview()
  │
  ├──► github.js: fetchPR()          → GET GitHub API → PR metadata
  │
  ├──► github.js: fetchFiles()       → GET GitHub API → diffs + full content
  │
  ├──► gemini.js: reviewBatch() x N  → POST Gemini API → findings JSON  (parallel)
  │
  ├──► gemini.js: synthesize()       → POST Gemini API → verdict + summary
  │
  └──► Save completed Review to MongoDB
  │
  ▼
Express returns completed Review JSON
  │
  ▼
React renders ReviewResult component
```

---

## Next Steps to Improve the Project

These are real improvements worth discussing in an interview:

### 1. Async Processing with a Job Queue
Right now, the review runs synchronously — the HTTP request stays open until the review is done (can take 30-60 seconds). A better approach is to return immediately with a `review_id` and let the frontend poll or use WebSockets to get notified when done. Tools: **BullMQ** (Redis-based queue) or **Vercel background functions**.

### 2. Caching
If someone reviews the same PR twice at the same commit, there's no reason to call Gemini again. The backend already computes a `cache_key` (`owner/repo/number/sha`) — the next step is to check if a completed review with that key already exists and return it directly.

### 3. GitHub App / Webhook Integration
Instead of users pasting URLs manually, the system could be installed as a **GitHub App**. GitHub would send a webhook event whenever a PR is opened, and the review would be posted automatically as a PR comment. This is how tools like Reviewdog and CodeRabbit work.

### 4. Authentication
Right now anyone can use the app and see everyone's review history. Adding **user accounts** (OAuth with GitHub) would let each user see only their own reviews.

### 5. Better Token Counting
The current batching uses a rough estimate (chars / 4 ≈ tokens). Using the actual **Gemini tokenizer** API would give more accurate batching and avoid hitting context limits.

### 6. Support for Private Repos
Private repos require the user to provide a GitHub token. An OAuth flow where the user grants access to their repos would enable this.

### 7. CI/CD Integration
Provide a CLI tool or GitHub Action that runs the review as part of a CI pipeline and fails the build if blockers are found.

---

## How to talk about this in an interview

**"What does this project do?"**
> It's an AI-powered code review tool. You give it a GitHub PR URL, it fetches the diffs using the GitHub API, sends them to a Gemini AI model with a structured prompt asking for JSON-formatted findings, and stores the results in MongoDB. The frontend is React with Tailwind CSS, and the whole thing is deployed on Vercel.

**"What was the hardest part?"**
> Handling large PRs that exceed the model's context window. I solved it by batching files based on estimated token count and running the batches in parallel, then merging and sorting the results before a final synthesis call.

**"What would you improve?"**
> The biggest gap is that reviews run synchronously — the HTTP request stays open while Gemini is thinking. I'd move to a job queue (like BullMQ) so the API returns immediately with a job ID and the frontend polls or uses WebSockets for the result. I'd also add caching by PR commit SHA so repeated reviews don't waste API calls.

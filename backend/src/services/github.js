const axios = require('axios');

const SKIP_EXTENSIONS = new Set([
  '.lock', '.snap', '.min.js', '.min.css', '.map', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip',
  '.gz', '.tar', '.bin', '.exe', '.dll', '.so', '.dylib',
]);

const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock',
  'Gemfile.lock', 'poetry.lock', 'Pipfile.lock',
]);

const MAX_FILE_CHARS = 120_000;
const MAX_FILES = 50;

function makeClient() {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return axios.create({ baseURL: 'https://api.github.com', headers, timeout: 30_000 });
}

function parsePRUrl(url) {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) throw Object.assign(new Error('Invalid GitHub PR URL'), { code: 'invalid_pr_url' });
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

function shouldSkip(filename) {
  if (SKIP_FILENAMES.has(filename.split('/').pop())) return true;
  const ext = filename.match(/(\.[^.]+)$/)?.[1];
  return ext ? SKIP_EXTENSIONS.has(ext.toLowerCase()) : false;
}

async function fetchAllPages(client, url, params = {}) {
  const results = [];
  let page = 1;
  while (true) {
    const { data } = await client.get(url, { params: { ...params, per_page: 100, page } });
    results.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return results;
}

async function fetchPR(owner, repo, number) {
  const client = makeClient();
  try {
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls/${number}`);
    return {
      owner,
      repo,
      number,
      title: data.title,
      description: (data.body || '').slice(0, 3000),
      head_sha: data.head.sha,
      base_sha: data.base.sha,
      files_changed: data.changed_files,
      additions: data.additions,
      deletions: data.deletions,
      pr_url: data.html_url,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      throw Object.assign(new Error('PR not found or private'), { code: 'pr_not_found' });
    }
    throw Object.assign(new Error(`GitHub API error: ${err.message}`), { code: 'upstream_error' });
  }
}

async function fetchFiles(owner, repo, number, headSha) {
  const client = makeClient();
  const allFiles = await fetchAllPages(client, `/repos/${owner}/${repo}/pulls/${number}/files`);

  const skipped = [];
  const reviewable = [];

  for (const f of allFiles) {
    if (f.status === 'removed' || shouldSkip(f.filename) || !f.patch) {
      skipped.push(f.filename);
      continue;
    }
    reviewable.push(f);
  }

  const prioritized = reviewable
    .sort((a, b) => {
      if (a.status === 'modified' && b.status !== 'modified') return -1;
      if (b.status === 'modified' && a.status !== 'modified') return 1;
      return (b.changes || 0) - (a.changes || 0);
    })
    .slice(0, MAX_FILES);

  const filesWithContent = await Promise.allSettled(
    prioritized.map(async (f) => {
      let fullContent = null;
      try {
        const { data } = await client.get(
          `/repos/${owner}/${repo}/contents/${encodeURIComponent(f.filename)}`,
          { params: { ref: headSha } }
        );
        if (data.encoding === 'base64') {
          const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
          fullContent = decoded.length > MAX_FILE_CHARS ? decoded.slice(0, MAX_FILE_CHARS) + '\n...[truncated]' : decoded;
        }
      } catch {
        // content fetch failed — fall back to diff only
      }
      return {
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || '',
        fullContent,
      };
    })
  );

  const files = filesWithContent
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  const skippedFromLimit = prioritized.length < reviewable.length
    ? reviewable.slice(MAX_FILES).map((f) => f.filename)
    : [];

  return { files, skipped: [...skipped, ...skippedFromLimit] };
}

module.exports = { parsePRUrl, fetchPR, fetchFiles };

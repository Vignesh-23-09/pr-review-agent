const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

let genAI = null;

function getClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

const PRIMARY_MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

async function withRetryAndFallback(fn, modelName) {
  const delays = [2000, 5000, 10000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn(modelName);
    } catch (err) {
      const is503 = err.status === 503 || err.message?.includes('503');
      if (is503 && attempt < delays.length) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      if (is503 && modelName !== FALLBACK_MODEL) {
        console.warn(`[gemini] ${modelName} unavailable after retries, falling back to ${FALLBACK_MODEL}`);
        return fn(FALLBACK_MODEL);
      }
      throw err;
    }
  }
}

const findingsSchema = {
  type: SchemaType.OBJECT,
  properties: {
    findings: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          file: { type: SchemaType.STRING },
          line: { type: SchemaType.INTEGER },
          severity: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          comment: { type: SchemaType.STRING },
          suggested_fix: { type: SchemaType.STRING },
        },
        required: ['file', 'severity', 'category', 'comment'],
      },
    },
  },
  required: ['findings'],
};

const synthesisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    verdict: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
  },
  required: ['verdict', 'summary'],
};

function buildReviewPrompt(prContext, files) {
  const fileBlocks = files
    .map((f) => {
      const content = f.fullContent
        ? `### Full file at HEAD\n\`\`\`\n${f.fullContent}\n\`\`\``
        : '';
      return `## File: ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})
### Diff
\`\`\`diff
${f.patch}
\`\`\`
${content}`;
    })
    .join('\n\n---\n\n');

  return `You are a senior software engineer conducting a thorough code review.

## Pull Request
- **Title**: ${prContext.title}
- **Description**: ${prContext.description || 'No description provided'}
- **Repository**: ${prContext.owner}/${prContext.repo}

## Your Task
Review ONLY the changed code in this PR. For each issue you find, produce a finding with:
- file: the file path
- line: the line number in the file at HEAD where the issue occurs (or null for file-level issues)
- severity: one of blocker | major | minor | info
  - blocker: correctness, security, or data-loss bug that must be fixed before merge
  - major: likely defect or significant design concern
  - minor: real but low-risk; fix now or soon
  - info: observation, question, or optional improvement
- category: one of bug | security | performance | error_handling | maintainability | testing | style
- comment: specific, actionable explanation referencing the code
- suggested_fix: concrete fix or null if not applicable

Rules:
1. Only comment on code that was CHANGED in this PR (the diff). Use the full file only for understanding context.
2. Every finding must cite a real file path from the PR.
3. Prefer concrete suggested_fix values — show the corrected code when short enough.
4. Do not invent line numbers — use actual line numbers from the file content shown.
5. Do not add drive-by refactor suggestions unrelated to the change.

## Files Changed

${fileBlocks}`;
}

function buildSynthesisPrompt(prContext, findings) {
  const findingsSummary = findings
    .map((f) => `- [${f.severity}/${f.category}] ${f.file}:${f.line ?? '?'} — ${f.comment}`)
    .join('\n');

  return `You are a senior software engineer writing the final summary of a code review.

## Pull Request
- **Title**: ${prContext.title}
- **Repository**: ${prContext.owner}/${prContext.repo}

## Findings from detailed review
${findingsSummary || 'No issues found.'}

## Your Task
Based on the findings above, produce:
- verdict: one of:
  - "approve" — no significant issues; PR is good to merge
  - "approve_with_nits" — only minor/info issues; can merge after addressing nits
  - "request_changes" — has blocker or major issues that must be fixed
- summary: 3-5 sentences summarizing the overall quality of the PR, the most important issues, and any noteworthy positives. Be specific and reference actual code concerns.`;
}

async function reviewBatch(prContext, files) {
  const client = getClient();
  const prompt = buildReviewPrompt(prContext, files);
  try {
    return await withRetryAndFallback(async (modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: findingsSchema,
          temperature: 0.2,
        },
      });
      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      return (parsed.findings || []).filter(
        (f) => f.file && f.severity && f.category && f.comment
      );
    }, PRIMARY_MODEL());
  } catch (err) {
    rethrowGeminiError(err);
  }
}

async function synthesize(prContext, findings) {
  const client = getClient();
  const prompt = buildSynthesisPrompt(prContext, findings);
  try {
    return await withRetryAndFallback(async (modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: synthesisSchema,
          temperature: 0.2,
        },
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    }, PRIMARY_MODEL());
  } catch (err) {
    rethrowGeminiError(err);
  }
}

function rethrowGeminiError(err) {
  if (err.status === 429) {
    const retryMatch = err.message?.match(/retry.*?(\d+)s/i);
    const retryIn = retryMatch ? `${retryMatch[1]}s` : 'a few minutes';
    throw Object.assign(
      new Error(`Gemini quota exceeded (free tier limit hit). Please retry in ${retryIn}, or enable billing at aistudio.google.com.`),
      { code: 'rate_limited' }
    );
  }
  throw Object.assign(new Error(`Gemini error: ${err.message}`), { code: 'upstream_error' });
}

module.exports = { reviewBatch, synthesize };

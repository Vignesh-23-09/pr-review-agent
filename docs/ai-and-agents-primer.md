# AI & AI Agents — A Beginner's Guide

Simple answers to the questions you'd actually ask. No jargon.

---

## Part 1: What is AI?

**Q: What even is AI?**

AI (Artificial Intelligence) is software that can do things that normally require human intelligence — like understanding language, recognizing images, writing code, or answering questions.

The AI you interact with today (like ChatGPT, Gemini, Claude) is specifically **generative AI** — it generates new content (text, images, code) based on what you ask it.

---

**Q: How does it actually work? Is it magic?**

Not magic — it's math. At the core is a **Large Language Model (LLM)**. Think of it as a very sophisticated autocomplete.

It was trained on billions of pages of text from the internet, books, and code. During training it learned patterns — which words and ideas tend to follow which others. When you ask it a question, it predicts the most likely next word, then the next, and so on, building a response one token at a time.

A **token** is roughly 3-4 characters (not exactly a word). "Hello world" is about 3 tokens. Models have a context window — the maximum amount of text they can "see" at once (like working memory).

---

**Q: What's the difference between AI and Machine Learning?**

- **AI** is the broad idea — machines that simulate intelligence
- **Machine Learning (ML)** is one approach to building AI — instead of programming rules by hand, you feed the machine data and it learns the rules itself
- **Deep Learning** is a type of ML that uses neural networks (layers of math inspired loosely by the brain)
- **LLMs** are a type of deep learning model trained specifically on language

Think of it as nested circles: AI > ML > Deep Learning > LLMs.

---

**Q: What are tokens and why do they matter?**

When an AI reads your text, it breaks it into tokens first. "unhappy" might be 2 tokens: "un" + "happy". Models have a token limit — how much they can read/write in one go.

This matters practically: if you send a huge file to Gemini and it's too large, you get an error. That's why in this project we batch the PR files — to stay under the token limit.

---

**Q: What is a prompt?**

A prompt is the text you send to the AI. The quality of the prompt directly affects the quality of the answer — this is called **prompt engineering**.

In this project, we write detailed prompts that tell Gemini:
- What role it's playing ("You are a senior software engineer")
- What to look at (the PR diff and full file)
- Exactly what format to respond in (JSON with specific fields)

---

**Q: What does "temperature" mean in AI?**

Temperature controls how creative/random the AI's output is.
- **Low temperature (0.1–0.3)** → consistent, focused, predictable — good for code review and structured output
- **High temperature (0.8–1.0)** → more creative, varied, sometimes unexpected — good for brainstorming or writing

We use `temperature: 0.2` in this project because we want consistent, structured findings, not creative writing.

---

**Q: What is structured output / JSON mode?**

Normally, AI responds in plain text. But you can tell it to respond in a specific JSON format — and enforce it with a schema. This is called **structured output**.

Instead of:
> "I found a potential SQL injection issue in auth.js around line 42..."

We get:
```json
{
  "findings": [
    {
      "file": "auth.js",
      "line": 42,
      "severity": "blocker",
      "category": "security",
      "comment": "SQL injection risk — user input directly interpolated into query"
    }
  ]
}
```

This is much easier to parse and display in the UI. Gemini supports this natively via `responseMimeType: "application/json"` and `responseSchema`.

---

## Part 2: What is an AI Agent?

**Q: What's the difference between AI and an AI Agent?**

| | Plain AI (LLM) | AI Agent |
|---|---|---|
| What it does | Answers one question at a time | Takes actions, uses tools, completes multi-step tasks |
| Memory | Only what's in the current prompt | Can remember things across steps |
| Tools | None — just generates text | Can search the web, run code, call APIs |
| Decision making | One shot | Plans, acts, observes result, adjusts |

**Simple analogy:**
- **AI** is like asking a very smart person a question and getting an answer.
- **AI Agent** is like hiring that person as an assistant — they don't just answer, they actually go do things: open your email, search the web, book a meeting, write a file.

---

**Q: What makes something an "agent"?**

An agent has a loop:
1. **Plan** — decide what to do next
2. **Act** — use a tool (search, API call, run code)
3. **Observe** — read the result
4. **Repeat** — until the task is done

A plain LLM has no loop. You ask, it answers. Done.

---

**Q: What are "tools" in the context of AI agents?**

Tools are functions the AI can call. Examples:
- `search_web(query)` — searches Google and returns results
- `run_code(code)` — executes Python and returns the output
- `send_email(to, subject, body)` — sends an email
- `read_file(path)` — reads a file from disk

The AI decides *when* to call which tool and *what arguments* to pass. This is called **tool use** or **function calling**.

---

**Q: Is this project an AI agent?**

Partially. It uses AI (Gemini) as a component, but it's not a fully autonomous agent because:
- The AI doesn't decide *what* to do — the pipeline is hardcoded (fetch PR → review → synthesize)
- The AI doesn't use tools — it just receives text and returns JSON
- There's no loop — each step is predetermined

To make it more agent-like, you could give Gemini tools like "fetch_file", "search_codebase", "post_comment" and let it decide how to conduct the review.

---

**Q: What's RAG?**

RAG stands for **Retrieval-Augmented Generation**. Instead of the AI relying only on what it learned during training, you first retrieve relevant documents and add them to the prompt.

Example: Instead of asking "What does function X do?", you:
1. Search your codebase for files related to function X
2. Add those files to the prompt
3. Ask the AI

This way the AI has up-to-date, specific context it couldn't have learned during training.

---

**Q: What's the difference between fine-tuning and prompting?**

| | Prompting | Fine-tuning |
|---|---|---|
| How it works | You guide the model with instructions in the prompt | You retrain the model on your specific data |
| Cost | Cheap (just API calls) | Expensive (compute + time) |
| Flexibility | Easy to change | Hard to change once done |
| Best for | Most use cases | Very specific tasks where prompting isn't enough |

For this project, prompting is the right choice. We don't need to fine-tune.

---

**Q: What's the difference between Gemini, ChatGPT, and Claude?**

They're all LLMs from different companies, competing for the same space:

| Model | Company | Notes |
|---|---|---|
| Gemini | Google | Good multimodal support (text, image, audio), integrates with Google products |
| GPT-4 / ChatGPT | OpenAI | The most well-known, strong general performance |
| Claude | Anthropic | Known for safety, long context windows, strong at coding |
| Llama | Meta | Open source — you can run it locally |

We use Gemini because it has a generous free tier and supports structured JSON output natively.

---

**Q: What is a context window?**

The context window is how much text the model can "see" at once — past messages, your prompt, the document you gave it, everything. If you exceed it, the model can't process the full input and you get an error.

Gemini 2.5 Flash has a 1 million token context window — very large. GPT-4 has 128K. Claude 3.5 has 200K.

This project batches PR files because even with large context windows, sending 50 large files in one shot is expensive and slow. Parallel batches are faster.

---

## Part 3: Interview Tips

**Common questions you might get:**

**"What is generative AI?"**
> Software that creates new content — text, images, code — by learning patterns from large amounts of training data. The core technology is a Large Language Model, which predicts the next token in a sequence based on everything it's seen.

**"What's the difference between AI and an AI agent?"**
> AI by itself just answers questions — one input, one output. An AI agent goes further: it can plan, use tools (search, run code, call APIs), observe the results, and loop until a task is done. Think of AI as a smart advisor vs. an AI agent as someone who actually does the work for you.

**"What is prompt engineering?"**
> Crafting the input you give to an AI model to get better, more accurate, and more consistent outputs. Things like telling the AI what role to play, giving it examples, specifying the output format, and setting constraints.

**"How did you use AI in this project?"**
> I use Google's Gemini model to review GitHub PR diffs. The key insight is using structured JSON output — instead of asking for a free-form review, I define a JSON schema and Gemini fills it in. This lets the backend reliably parse the findings without messy string parsing. I also handle 503 errors with retry logic and a fallback model so the system is resilient to Gemini's traffic spikes.

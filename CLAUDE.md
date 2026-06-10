@AGENTS.md

# LLM API Integration — Project Guide

## What this project is

A Next.js 16 (App Router) chat application that connects to an LLM and streams responses token-by-token to the browser. The active backend uses OpenAI; a full Anthropic implementation is commented out in the same file and can be swapped in by toggling the comments.

---

## Project structure

```
llm-api-integration/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts      # POST /api/chat — calls LLM, streams response back
│   ├── layout.tsx            # Root HTML shell, loads Geist fonts, applies global CSS
│   ├── page.tsx              # Full-screen chat UI (React client component)
│   └── globals.css           # Tailwind base styles
├── public/                   # Static SVG assets
├── .env.local                # API keys (never commit this)
├── next.config.ts            # Next.js config
├── postcss.config.mjs        # Tailwind v4 PostCSS setup
└── tsconfig.json             # TypeScript config
```

---

## Tech stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Framework | Next.js 16 — App Router             |
| Language  | TypeScript                          |
| Styling   | Tailwind CSS v4                     |
| LLM (active)     | OpenAI API via `openai` SDK  |
| LLM (alternate)  | Anthropic API via `@anthropic-ai/sdk` (commented out in route.ts) |

---

## Dev commands

```bash
npm run dev      # Start local dev server at http://localhost:3000
npm run build    # Compile production build
npm run start    # Serve the production build
npm run lint     # Run ESLint
```

---

## Environment variables

| Variable            | Required | Purpose                        |
|---------------------|----------|--------------------------------|
| `OPENAI_API_KEY`    | Yes (active)  | Authenticates OpenAI requests |
| `ANTHROPIC_API_KEY` | Yes (if switching to Anthropic) | Authenticates Anthropic requests |

Set both in `.env.local`. Never commit that file.

---

## How streaming works (end-to-end)

```
User submits message
       ↓
page.tsx — POST /api/chat  { messages: [...full history...] }
       ↓
route.ts — calls LLM with stream: true
       ↓
Wraps LLM stream in ReadableStream, pushes text chunks as bytes
       ↓
Returns streaming HTTP response (Content-Type: text/plain)
       ↓
page.tsx — reads response.body as ReadableStream
       ↓
Each chunk is decoded and appended to the last assistant message
       ↓
React re-renders the UI incrementally as tokens arrive
```

---

## Switching between OpenAI and Anthropic

In `app/api/chat/route.ts`:
- **Active**: OpenAI block (lines 42–71)
- **Alternate**: Anthropic block (lines 1–39, currently commented out)

To switch, comment out the OpenAI block and uncomment the Anthropic block. Both use the same streaming pattern and return the same response format, so the frontend needs no changes.

Known issue: the OpenAI model string is `"gpt-5.4-mini"` — this should be `"gpt-4o-mini"`. Fix this before running.

---

## Key files explained

### `app/api/chat/route.ts`
Next.js Route Handler. Exports a single `POST` function. Receives the message array, calls the LLM with streaming enabled, and returns a `ReadableStream` response that the browser can consume chunk-by-chunk.

### `app/page.tsx`
Client component (`"use client"`). Manages all chat state locally with `useState`. Sends messages to `/api/chat`, reads the streaming response body, and appends each decoded chunk to the last assistant message in state — producing the typewriter effect.

### `app/layout.tsx`
Server component. Sets page-level metadata, loads Google Fonts (Geist Sans + Geist Mono) as CSS variables, and wraps all pages in a full-height body.

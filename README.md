# BAL Chatbot Next.js

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Groq](https://img.shields.io/badge/Groq-LLM_Inference-F97316)](https://groq.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Optional-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Retrieval-Augmented Generation chatbot for Bornova Anadolu Lisesi, migrated from the original Flask app to a Next.js App Router project.

The app serves the existing BAL chatbot frontend, streams model responses from Groq through Next.js API routes, retrieves school-specific context from a bundled vectorstore, and supports anonymous fingerprint-based quotas, chat logging, and feedback.

Migration to Next.js by [FlyingGrasss](https://github.com/FlyingGrasss) | [Emre Bozkurt](https://www.instagram.com/emre.bozqurt).

---

## Features

- RAG pipeline over BAL knowledge-base chunks using local JSON vectors
- Query embeddings with `@xenova/transformers`
- Streaming chat responses through Server-Sent Events
- Groq model fallback chain and support for multiple API keys
- Anonymous FingerprintJS-based visitor identity
- Per-role rate limits for visitor, user, and admin roles
- Conversation memory for recent turns per session
- Optional PostgreSQL persistence for users, quotas, chat logs, and feedback
- In-memory fallback when `DATABASE_URL` is not configured
- Static migrated frontend served from `public/index.html`
- TypeScript-first Next.js API backend

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16, React 19, TypeScript |
| API | Next.js App Router route handlers |
| LLM | Groq Chat Completions API |
| Embeddings | `@xenova/transformers`, `intfloat/multilingual-e5-small` |
| Retrieval | Bundled vectorstore JSON, cosine-style dot product over normalized vectors |
| Storage | PostgreSQL via `pg`, with in-memory fallback |
| Frontend | Static HTML/CSS/JS, FingerprintJS vendor bundle |
| Package Manager | pnpm |

---

## Project Structure

```text
BAL-Chatbot-Nextjs/
|-- app/
|   |-- api/
|   |   |-- auth/status/route.ts       # Visitor identity and quota status
|   |   |-- chat/route.ts              # RAG + Groq SSE chat endpoint
|   |   |-- chat/feedback/route.ts     # Response feedback endpoint
|   |   |-- clear/route.ts             # Session clear endpoint
|   |   `-- health/route.ts            # System health endpoint
|   |-- layout.tsx
|   `-- page.tsx                       # Redirects to /index.html
|-- public/
|   |-- index.html                     # Migrated chatbot UI
|   |-- BAL_Logo.png
|   `-- vendor/fingerprintjs/fp.esm.js
|-- scripts/
|   `-- export_faiss_vectors.py        # Converts old FAISS data to JSON vectors
|-- src/
|   |-- data/vectorstore.json          # 142 embedded BAL chunks
|   `-- lib/
|       |-- config.ts                  # Models, limits, retrieval settings
|       |-- embeddings.ts              # Local embedding pipeline
|       |-- groq.ts                    # Streaming Groq client + fallback
|       |-- rag.ts                     # Retrieval and context formatting
|       |-- sessions.ts                # In-memory conversation sessions
|       |-- storage.ts                 # PostgreSQL/in-memory persistence
|       `-- prompt.ts                  # BAL assistant system prompt
|-- .env.example
|-- next.config.ts
|-- package.json
|-- pnpm-lock.yaml
`-- tsconfig.json
```

---

## Getting Started

### Prerequisites

- Node.js compatible with Next.js 16
- pnpm
- Groq API key from [console.groq.com](https://console.groq.com)
- Optional PostgreSQL database for persistent quotas, logs, and feedback

### Installation

```bash
pnpm install
```

Create an environment file:

```bash
cp .env.example .env.local
```

Set at least one Groq key:

```env
GROQ_API_KEY=your_groq_key_here
# or:
# GROQ_API_KEYS=key1,key2,key3
```

Optional production persistence:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Run the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes | Single Groq API key |
| `GROQ_API_KEYS` | No | Comma-separated Groq API key pool |
| `GROQ_MODEL_CHAIN` | No | Comma-separated fallback model chain |
| `DATABASE_URL` | No | PostgreSQL connection string |
| `PGSSL` | No | Set to `false` for local PostgreSQL without SSL |
| `EMBEDDING_MODEL` | No | Defaults to `intfloat/multilingual-e5-small` |
| `RETRIEVAL_TOP_K` | No | Defaults to `5` |
| `RETRIEVAL_SCORE_THRESHOLD` | No | Defaults to `0.35` |
| `GROQ_TIMEOUT_MS` | No | Defaults to `120000` |
| `LLM_TEMPERATURE` | No | Defaults to `0.1` |
| `LLM_MAX_TOKENS` | No | Defaults to `1024` |
| `LLM_TOP_P` | No | Defaults to `0.9` |
| `MAX_HISTORY_TURNS` | No | Defaults to `6` |
| `CONGESTION_THRESHOLD` | No | Defaults to `4` active requests |

Default Groq model chain:

```text
llama-3.3-70b-versatile,
meta-llama/llama-4-maverick-17b-128e-instruct,
qwen/qwen3-32b,
meta-llama/llama-4-scout-17b-16e-instruct
```

---

## API Reference

### `POST /api/chat`

Streams an answer using SSE.

Request:

```json
{
  "message": "LGS taban puani nedir?",
  "session_id": "session_abc123"
}
```

Important header:

```text
x-client-fingerprint: visitor_fingerprint_id
```

SSE response examples:

```text
data: {"token":"BAL hakkinda..."}
data: {"done":true,"sources":[{"breadcrumb":"...","score":0.71}],"question_index":1}
```

### `GET /api/health`

Returns vectorstore, embedding, database, provider, model, and overall health status.

### `GET /api/auth/status`

Returns anonymous visitor identity, role, and quota status.

### `POST /api/chat/feedback`

Stores feedback for a previously saved response.

```json
{
  "question_index": 1,
  "feedback": "like",
  "feedback_text": "Helpful answer"
}
```

### `POST /api/clear`

Clears the current in-memory conversation session.

---

## Rate Limits

| Role | Daily Limit | Minute Limit |
| --- | ---: | ---: |
| Visitor | 40 | 5 |
| User | 50 | 8 |
| Admin | 500 | 20 |

---

## Vectorstore Migration

The original Flask version used FAISS files at runtime. This Next.js version stores vectors in `src/data/vectorstore.json` so retrieval can run directly inside the Next.js API layer.

If the original FAISS files and chunk metadata are available in the parent project layout, regenerate the JSON vectorstore with:

```bash
pnpm export:vectors
```

The script expects the old files at:

```text
../data/bal_faiss.index
../data/bal_chunks.json
../data/vectorstore_config.json
```

---

## Build

```bash
pnpm build
pnpm start
```

---

## Credits

- Original BAL chatbot project and knowledge-base work: [Burak599](https://github.com/Burak599)
- Next.js migration: [FlyingGrasss](https://github.com/FlyingGrasss) | [Emre Bozkurt](https://www.instagram.com/emre.bozqurt)

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

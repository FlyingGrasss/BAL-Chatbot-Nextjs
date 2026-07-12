# BAL Chatbot Next.js

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-Primary_LLM-4285F4?logo=google&logoColor=white)](https://ai.google.dev/gemini-api)
[![Groq](https://img.shields.io/badge/Groq-Fallback_LLM-F97316)](https://groq.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Optional-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Retrieval-Augmented Generation chatbot for Bornova Anadolu Lisesi, migrated from the original Flask app to a Next.js App Router project.

The app serves the BAL chatbot frontend, streams model responses from Gemini through Next.js API routes with Groq as a final fallback, retrieves school-specific context from a bundled vectorstore, and supports anonymous fingerprint-based quotas, chat logging, and feedback.

Migration to Next.js by [FlyingGrasss](https://github.com/FlyingGrasss) | [Emre Bozkurt](https://www.instagram.com/emre.bozqurt).

---

## Features

- RAG pipeline over BAL knowledge-base chunks using local JSON vectors
- Query embeddings through the Hugging Face Inference API
- Streaming chat responses through Server-Sent Events
- Gemini model and API-key rotation, with Groq as the final provider fallback
- Selective Google Search grounding for explicitly current or web-search questions
- Client-supplied conversation history that survives serverless instance changes
- Anonymous FingerprintJS-based visitor identity
- Per-role rate limits for visitor, user, and admin roles
- Conversation memory for recent turns per session
- Optional PostgreSQL persistence for users, quotas, chat logs, and feedback
- In-memory fallback when `DATABASE_URL` is not configured
- Native Next.js page rendered from `app/page.tsx`
- TypeScript-first Next.js API backend

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16, React 19, TypeScript |
| API | Next.js App Router route handlers |
| LLM | Gemini API, with Groq Chat Completions fallback |
| Embeddings | Hugging Face Inference API, `intfloat/multilingual-e5-small` |
| Retrieval | Bundled vectorstore JSON, cosine-style dot product over normalized vectors |
| Storage | PostgreSQL via `pg`, with in-memory fallback |
| Frontend | React client components, CSS, FingerprintJS vendor bundle |
| Package Manager | pnpm |

---

## Project Structure

```text
BAL-Chatbot-Nextjs/
|-- app/
|   |-- api/
|   |   |-- auth/status/route.ts       # Visitor identity and quota status
|   |   |-- admin/feedback/route.ts    # Password-protected feedback listing
|   |   |-- chat/route.ts              # RAG + Gemini/Groq SSE chat endpoint
|   |   |-- chat/feedback/route.ts     # Response feedback endpoint
|   |   |-- clear/route.ts             # Session clear endpoint
|   |   `-- health/route.ts            # System health endpoint
|   |-- globals.css                    # App styling
|   |-- admin/page.tsx                 # Admin feedback view
|   |-- layout.tsx
|   `-- page.tsx                       # Chat UI and client interactions
|-- public/
|   |-- BAL_Logo.png
|   `-- vendor/fingerprintjs/fp.esm.js
|-- scripts/
|   |-- build-vectorstore.mjs          # Builds the live index from Markdown
|   `-- export_faiss_vectors.py        # Legacy FAISS import utility
|-- src/
|   |-- data/RAG_Dataset_BAL.md        # Canonical editable knowledge source
|   |-- data/vectorstore.json          # Generated embedded BAL chunks
|   `-- lib/
|       |-- config.ts                  # Models, limits, retrieval settings
|       |-- embeddings.ts              # Hugging Face embedding API client
|       |-- llm.ts                     # Gemini rotation + Groq provider fallback
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
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Optional Groq API key from [console.groq.com](https://console.groq.com) for final fallback
- Optional PostgreSQL database for persistent quotas, logs, and feedback

### Installation

```bash
pnpm install
```

Create an environment file:

```bash
cp .env.example .env.local
```

Set at least one Gemini key. Additional numbered keys are tried when a key is exhausted:

```env
GEMINI_API_KEY=your_primary_gemini_key
GEMINI_API_KEY_2=your_secondary_gemini_key

# Optional final provider fallback
GROQ_API_KEY=your_groq_key
```

Optional production persistence:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
HF_TOKEN=your_hugging_face_token
ADMIN_PASSWORD=your_admin_password
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
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEYS` | No | Comma-separated Gemini API key pool |
| `GEMINI_API_KEY_2` ... `GEMINI_API_KEY_5` | No | Additional Gemini keys used after quota/auth failures |
| `GEMINI_MODEL_CHAIN` | No | Comma-separated per-model quota fallback chain |
| `GEMINI_TIMEOUT_MS` | No | Defaults to `120000` |
| `GEMINI_SEARCH_GROUNDING` | No | Enables selective Google Search grounding; defaults to `true` |
| `GEMINI_SEARCH_MODEL` | No | Grounded-query model; defaults to `gemini-3.1-flash-lite` |
| `GROQ_API_KEY` | No | Single Groq fallback API key |
| `GROQ_API_KEYS` | No | Comma-separated Groq API key pool |
| `GROQ_API_KEY_2` ... `GROQ_API_KEY_5` | No | Additional Groq fallback keys |
| `GROQ_MODEL_CHAIN` | No | Comma-separated fallback model chain |
| `DATABASE_URL` | No | PostgreSQL connection string |
| `PGSSL` | No | Set to `false` for local PostgreSQL without SSL |
| `HF_TOKEN` | Recommended | Hugging Face token for query embeddings |
| `ADMIN_PASSWORD` | Recommended | Password for `/admin` feedback view |
| `EMBEDDING_MODEL` | No | Defaults to `intfloat/multilingual-e5-small` |
| `INDEX_CHUNK_MAX_CHARS` | No | Maximum generated chunk size, defaults to `1200` |
| `INDEX_EMBED_BATCH_SIZE` | No | Hugging Face indexing batch size, defaults to `8` |
| `RETRIEVAL_TOP_K` | No | Defaults to `5` |
| `RETRIEVAL_SCORE_THRESHOLD` | No | Defaults to `0.35` |
| `GROQ_TIMEOUT_MS` | No | Defaults to `120000` |
| `LLM_TEMPERATURE` | No | Defaults to `0.1` |
| `LLM_MAX_TOKENS` | No | Defaults to `1024` |
| `LLM_TOP_P` | No | Defaults to `0.9` |
| `MAX_HISTORY_TURNS` | No | Conversation turns sent to the model; defaults to `60` |
| `CONGESTION_THRESHOLD` | No | Defaults to `4` active requests |

Default Gemini model chain:

```text
gemini-3.1-flash-lite,
gemini-2.5-flash,
gemini-3.5-flash,
gemini-3-flash-preview,
gemini-2.5-flash-lite
```

Default Groq fallback model chain:

```text
llama-3.3-70b-versatile,
qwen/qwen3-32b,
meta-llama/llama-4-scout-17b-16e-instruct,
llama-3.1-8b-instant
```

---

## API Reference

### `POST /api/chat`

Streams an answer using SSE. Gemini is attempted first; Groq is used only when all configured Gemini attempts fail.

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

### `GET /api/admin/feedback`

Returns feedback records. Requires:

```text
X-Admin-Password: your_admin_password
```

The browser view is available at `/admin`.

### `POST /api/clear`

Clears the current in-memory conversation session.

---

## Rate Limits

| Role | Daily Limit | Minute Limit |
| --- | ---: | ---: |
| Visitor | 30 | 5 |
| User | 30 | 5 |
| Admin | 500 | 20 |

In addition, chat requests receive a hashed-IP burst guard of 30 requests per
minute by default. This value can be changed with `IP_MINUTE_LIMIT`; there is
no shared daily quota across users on the same network.

---

## Knowledge Base and Indexing

`src/data/RAG_Dataset_BAL.md` is the canonical editable knowledge source. `src/data/vectorstore.json` is generated from it and should not be edited manually.

Preview deterministic chunking without making API calls:

```bash
pnpm index:data:dry
```

Rebuild the complete vectorstore using `HF_TOKEN` from `.env.local`:

```bash
pnpm index:data
```

The generated file records the source SHA-256, embedding model and chunking configuration. The old FAISS conversion script remains available as `pnpm export:legacy-vectors` only for legacy imports.

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

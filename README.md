# RepoLens

An AI-assisted codebase intelligence tool (Codebase Compass). Paste a public GitHub URL, inspect the stack from real manifests, browse a filtered tree, and ask questions that cite file paths and line ranges.

Nothing from the repository is executed. Source is treated as untrusted data.

## Stack

- React + TypeScript + Vite + Tailwind
- Node.js + Express + Zod
- PostgreSQL + Prisma (full-text search)
- Python FastAPI analyzer (manifests + Python `ast` + JS/TS structure)
- Optional OpenAI-compatible LLM for grounded explanations

## Setup

1. Copy environment values:

```bash
cp .env.example .env
```

2. Start PostgreSQL (mapped to localhost:5434 by default) and install JavaScript dependencies:

```bash
docker compose up -d db
npm install
npx prisma migrate deploy
npx prisma generate
```

3. Python 3.10+ for the analyzer (created automatically by `npm run dev`).

4. Set `GITHUB_TOKEN` in `.env` before analyzing repositories. Without it, GitHub limits requests to 60 per hour per originating IP; a personal access token raises the authenticated quota. Use a read-only token and keep it in the server-side `.env` file (never in frontend code). If a token has just been added or changed, restart the API.

5. Optional: set `OPENAI_API_KEY` for natural-language answers. `OPENAI_MODEL` defaults to `gpt-4o-mini`. Without an OpenAI key, RepoLens answers by quoting the most relevant retrieved source chunks.

6. Run everything:

```bash
npm run dev
```

## How repository analysis and answers work

- GitHub's REST API supplies repository metadata and the file tree. RepoLens downloads selected source and manifest files, then the Python analyzer detects technologies from dependency/configuration files and extracts code structure with parsers. This indexing step does not call an AI model.
- Questions are matched against indexed code using PostgreSQL full-text search, with a basic keyword fallback. This search does not use embeddings or an AI model.
- When `OPENAI_API_KEY` is configured, the selected `OPENAI_MODEL` (default `gpt-4o-mini`) drafts an answer from retrieved excerpts. RepoLens validates citations against the retrieved files. Without the key, it returns source excerpts directly.

## Tests

```bash
npm run test -w @repolens/api
cd services/analyzer && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pytest -q
```

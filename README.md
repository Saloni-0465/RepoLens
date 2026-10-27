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

4. Optional: set `GITHUB_TOKEN` (raises GitHub rate limits) and `OPENAI_API_KEY` (natural-language answers). Without an LLM key, questions return extractive quotes from retrieved files.

5. Run everything:

```bash
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:4000/api/health
- Analyzer: http://localhost:8001/health

## Tests

```bash
npm run test -w @repolens/api
cd services/analyzer && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pytest -q
```

## Proposal

The original project proposal is in `docs/Codebase_Compass_Updated_Project_Proposal.docx`.

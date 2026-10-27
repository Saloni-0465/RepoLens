# RepoLens architecture

RepoLens implements the Codebase Compass proposal: inspect a public GitHub repository without executing it, detect technologies from manifests, extract code structure, and answer questions from retrieved source.

```
Browser (React / Vite)
        │
        ▼
Node API (Express / TypeScript / Prisma)
        │
        ├── GitHub REST + raw file fetch
        ├── PostgreSQL (metadata, files, chunks, FTS)
        └── Python analyzer (FastAPI)
                 ├── manifest detectors
                 └── Python AST + JS/TS regex parsers
```

## Data flow

1. `POST /api/repositories/analyze` validates a GitHub URL and creates an `AnalysisRun`.
2. The pipeline loads metadata, the recursive git tree, and a capped set of source/manifest files.
3. Binaries, dependency folders, lockfiles, and secret-like names are skipped.
4. The analyzer returns technology findings, symbols, summaries, and chunks with line ranges.
5. `POST /api/repositories/:id/questions` retrieves chunks with PostgreSQL full-text search, then either quotes them or asks a hosted LLM if `OPENAI_API_KEY` is set. Citations are checked against retrieved paths.

## Limits

Configured in `.env`: `MAX_FILES`, `MAX_FILE_BYTES`, `MAX_TOTAL_BYTES`. Analyses are keyed to the commit SHA stored on `Repository.analyzedRevision`.

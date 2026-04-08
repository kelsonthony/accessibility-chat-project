# Hand Talk Challenge

Production-style monorepo for an accessibility-first chatbot, telemetry engine, and RAG-ready knowledge assistant.

## Structure

- `backend/`: NestJS API with auth, telemetry, chat fallback, and ingestion modules.
- `frontend/`: React/Next.js app with auth flow, chat UI, and client-side telemetry batching.
- `packages/contracts/`: shared contracts between backend and frontend.
- `docs/`: architecture notes and decisions.

## Run locally

1. `npm install`
2. Start PostgreSQL with pgvector via `docker compose up -d postgres`
3. Copy `.env.example` to `.env` if you need custom ports or secrets.
4. `npm run dev:backend`
5. `npm run dev:frontend`

## API flow

- `POST /signup` and `POST /login` issue JWT tokens.
- `POST /collect` persists batched telemetry events in PostgreSQL.
- `GET /data` exposes persisted telemetry with simple filters.
- `POST /sources/sync` seeds official-source metadata into the database.
- `POST /ingest` seeds chunked source content into `documents` and `document_chunks`.
- `POST /ask` uses ingested chunks when available and falls back when retrieval has no match.

## Notes

- PostgreSQL is now the source of truth for users, telemetry, documents, chunks, and ingestion jobs.
- The Oracle PostgreSQL instance behind the SSH tunnel does not have `pgvector` installed, so embeddings are currently stored as `jsonb` for compatibility.
- The current ingestion implementation seeds authoritative public sources as an MVP bridge until full remote fetch/parsing is added.

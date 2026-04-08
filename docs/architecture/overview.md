# Architecture Overview

The repository is organized around two primary applications:

- `backend/` handles authentication, telemetry ingestion, data inspection, chat orchestration, and future RAG ingestion.
- `frontend/` handles login/signup, chat interactions, accessible UX, and buffered telemetry delivery.

The current implementation keeps persistence in memory for demo flows and preserves API contracts so PostgreSQL, queues, and pgvector can be connected without changing the external surface.


# ADR 0001: Fallback-first chatbot

## Decision

Keep `/ask` operational with deterministic fallback answers while the retrieval and ingestion pipeline is still incomplete.

## Why

- The challenge values delivery and product realism.
- Telemetry and authentication can be demonstrated without waiting for full RAG ingestion.
- The API contract remains stable for the later retrieval implementation.

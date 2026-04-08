Sim — **estava faltando coisa importante**.

O `AGENTS.md` anterior ficou bom como visão de produto, mas ainda não estava totalmente alinhado ao **desafio real** da Hand Talk. Faltavam principalmente:

* conexão explícita com o **cenário de coleta massiva de telemetria**
* definição de que o chat pode usar **RAG + fallback mock**
* preocupação com **alto volume no `/collect` sem travar o event loop**
* estratégia de **batching no front**
* preocupação com **privacidade/minimização de dados**
* estrutura de **monorepo**
* critérios de **entrega, testes, observabilidade e README**
* um caminho de MVP caso a ingestão documental não fique pronta a tempo

Então abaixo vai uma **versão revisada e muito mais forte do `AGENTS.md`**, pronta para usar no Codex.

---

````md
# AGENTS.md

# 🌍 Hand Talk Challenge — Accessibility Telemetry Chatbot with RAG

## 1. Product Mission

Build a production-style monorepo that solves the challenge with two complementary goals:

1. Deliver a **minimal but solid chatbot experience**
2. Build a **robust telemetry and ingestion platform** capable of collecting large volumes of user interaction data safely and asynchronously

This project must reflect the Hand Talk context:

- accessibility as a core value
- telemetry as a strategic asset
- scalable backend ingestion
- product thinking
- clean engineering decisions

This is not just a chatbot.

This is a **chatbot + telemetry engine + accessibility knowledge assistant**.

---

## 2. Main Strategy

The project should be designed around two layers:

### Layer A — User-facing Chatbot
A simple authenticated chat UI where the user can ask questions and receive answers.

The chatbot may operate in one of these modes:

1. **RAG mode** using official accessibility documents
2. **Fallback mode** with deterministic/mock answers if ingestion is not fully ready
3. Optional hybrid mode: try RAG first, fallback to curated answers

### Layer B — Telemetry Engine
The real focus of the challenge is to silently and safely collect valuable interaction data from the user journey.

Telemetry must be treated as a first-class product feature.

---

## 3. Core Technical Decision

We do **not** train a custom LLM.

We use **RAG (Retrieval-Augmented Generation)**.

Flow:

User question  
→ retrieve relevant document chunks  
→ assemble context  
→ ask LLM with grounded context  
→ return answer with source attribution when possible

This keeps the system:

- cheaper
- easier to update
- more explainable
- better for compliance
- more realistic for a challenge/MVP

---

## 4. Challenge Alignment

The implementation must respect the original challenge requirements:

### Required
- Backend in **Node.js + NestJS + TypeScript**
- Frontend in **React + TypeScript**
- Database justified by scalability and security
- Docker + docker-compose
- Auth with JWT
- `/signup`
- `/login`
- `/collect`
- `/data`

### Strong Differentials
- front-end telemetry batching
- accessibility-first interface
- optional real-time chat via WebSockets
- structured logging
- CI
- automated tests
- clear README

---

## 5. Monorepo Structure

Use a simple monorepo with two main apps:

```text
/
  backend/
  frontend/
  docker-compose.yml
  README.md
````

Recommended expanded structure:

```text
/
  backend/
    src/
      auth/
      users/
      telemetry/
      rag/
      ingestion/
      documents/
      common/
      config/
    test/
    Dockerfile

  frontend/
    src/
      app/
      features/auth/
      features/chat/
      features/telemetry/
      components/
      services/
      hooks/
      accessibility/
    public/
    Dockerfile

  docs/
    architecture/
    decisions/

  docker-compose.yml
  .env.example
  README.md
  AGENTS.md
```

---

## 6. Product Scope

## 6.1 Backend Responsibilities

### Auth

* `POST /signup`
* `POST /login`

Requirements:

* secure password hashing
* JWT token issuance
* validation and proper HTTP errors
* never expose sensitive details

### Telemetry Ingestion

* `POST /collect`

Requirements:

* JWT required
* must support high request volume
* must avoid blocking the Node.js event loop
* should accept single events or batched events
* should validate event schema
* should enqueue/persist efficiently

### Telemetry Query

* `GET /data`

Requirements:

* allow evaluator inspection
* simple filtering by user, event type, date range
* easy to prove that ingestion works

### Chat / RAG

* `POST /ask`

Requirements:

* authenticated endpoint
* receives user question
* uses RAG if available
* fallback to mock/heuristic mode if needed
* returns answer and optional citations

### Source Management

* `POST /sources/sync`
* `POST /ingest`

These endpoints may be internal/admin-only in the MVP.

Purpose:

* ingest official accessibility sources
* parse and chunk documents
* generate embeddings
* populate retrieval store

---

## 6.2 Frontend Responsibilities

### Authentication

* signup form
* login form
* token persistence
* guarded authenticated area

### Chat UI

* simple and clean interface
* message list
* input area
* send action
* loading state
* error state

### Telemetry Collection

The frontend must silently collect valuable signals.

This is a key evaluation area.

### Accessibility-first UI

The UI itself must reflect accessibility best practices:

* keyboard navigation
* focus visibility
* semantic HTML
* labels and ARIA where appropriate
* acceptable contrast
* screen-reader-friendly behavior

---

## 7. Telemetry Strategy

Telemetry is one of the most important parts of the challenge.

The app must capture signals that are useful for:

* future AI training
* product analytics
* accessibility improvements
* behavior understanding

Do not collect random noise.

Collect events that reflect real product value.

### Recommended Telemetry Categories

#### Session lifecycle

* session_started
* session_ended
* login_succeeded
* login_failed
* signup_succeeded
* signup_failed

#### Chat interaction

* message_started
* message_sent
* message_cleared
* message_edited
* answer_received
* answer_regenerated
* source_citation_clicked

#### Hesitation / friction

* typing_pause_detected
* repeated_backspace_burst
* message_abandoned
* repeated_question_rephrase
* validation_error_seen

#### Accessibility behavior

* keyboard_navigation_detected
* focus_loss_detected
* high_contrast_mode_enabled
* language_changed
* assistive_pattern_detected
* accessibility_help_opened

#### Performance / system

* request_latency_observed
* batch_flush_success
* batch_flush_failed
* websocket_disconnected
* retry_triggered

### Example Event Shape

```json
{
  "userId": "uuid",
  "sessionId": "uuid",
  "eventType": "typing_pause_detected",
  "timestamp": "2026-04-08T16:00:00Z",
  "metadata": {
    "chatLanguage": "pt",
    "inputLength": 120,
    "pauseMs": 4500,
    "deviceType": "desktop",
    "route": "/chat"
  }
}
```

---

## 8. Frontend Batching Strategy

This is a strong differential and should be implemented.

Do not send one request per event unless necessary.

Use client-side buffering:

* accumulate events in memory
* flush by size threshold
* flush by time interval
* flush on page hide/unload when possible
* retry failed batches safely

Recommended behavior:

* flush every N events or every X seconds
* use `sendBeacon` when appropriate for unload scenarios
* keep the implementation simple and resilient

Example:

* flush when batch size >= 20
* or every 5 seconds
* or when app is backgrounded

---

## 9. Backend Ingestion Strategy

The `/collect` endpoint must not perform heavy synchronous work.

Preferred design:

* validate quickly
* persist efficiently
* avoid CPU-heavy processing in request path
* respond fast

Good approaches for MVP:

1. write directly using optimized bulk insert patterns
2. queue internally for async processing
3. receive batches and insert in chunks

Avoid:

* complex synchronous transformations
* expensive per-event operations
* embedding generation in request path
* large object serialization loops

If using WebSockets for chat, keep telemetry ingestion over HTTP unless there is a strong reason otherwise.

---

## 10. RAG Strategy

## 10.1 Goal

Provide grounded answers about accessibility using official sources.

## 10.2 Do not train a model

We are not fine-tuning a custom LLM for this challenge.

We are:

* extracting official content
* chunking it
* indexing it
* retrieving relevant chunks
* passing them as context to the LLM

## 10.3 RAG Flow

```text
Question
  ↓
Language detection
  ↓
Embedding generation
  ↓
Vector search
  ↓
Top-k chunk retrieval
  ↓
Context assembly
  ↓
LLM grounded answer
  ↓
Return answer + citations
```

---

## 11. Knowledge Sources

Use official and authoritative accessibility sources whenever possible.

### Public sources suitable for ingestion

* WCAG 2.2
* Understanding WCAG
* WAI supporting docs
* UN CRPD
* Brazil LBI
* Brazil accessibility-related decrees and government guidance
* Section 508
* EN 301 549
* other public accessibility regulations by region

### ISO note

Do not ingest paid ISO full text unless it is publicly available and legally usable.

Allowed:

* public ISO pages
* metadata
* summaries
* public references
* open/publicly available standards text

Not allowed:

* unauthorized ingestion of paid ISO documents

---

## 12. Multilingual Strategy

The chatbot must support:

* Portuguese
* English
* Spanish

### Rules

* store each document in its original language
* use multilingual embeddings
* answer in the user's language
* preserve the original source metadata
* when no official translation exists, make it clear the answer is based on translated interpretation

### Language behavior

* auto-detect user language from question
* allow manual language switch in UI
* keep telemetry aware of selected language

---

## 13. Document Ingestion Strategy

Use:

* HTML parsing for structured web sources
* Docling for PDFs when appropriate

### Ingestion pipeline

1. fetch/download source
2. parse content
3. normalize text
4. split into chunks
5. enrich with metadata
6. generate embeddings
7. store in vector index

### Chunking rules

Split by meaningful semantic units:

* article
* section
* criterion
* guideline
* clause

Never store huge full documents as a single chunk.

Example chunk:

```json
{
  "id": "wcag_1_4_3_en",
  "content": "The visual presentation of text and images of text has a contrast ratio...",
  "source": "WCAG 2.2",
  "section": "1.4.3 Contrast (Minimum)",
  "jurisdiction": "GLOBAL",
  "language": "en",
  "type": "guideline",
  "officialUrl": "https://www.w3.org/TR/WCAG22/"
}
```

---

## 14. Metadata Model

Each chunk should have rich metadata.

Recommended shape:

```json
{
  "id": "string",
  "content": "string",
  "language": "pt|en|es|other",
  "source": "string",
  "sourceType": "law|standard|guideline|reference",
  "jurisdiction": "GLOBAL|BR|US|EU|ASIA|AFRICA|OTHER",
  "country": "string|null",
  "section": "string|null",
  "category": "perceivable|operable|understandable|robust|legal|general",
  "priority": "mandatory|recommended|informative",
  "officialUrl": "string",
  "officialTranslation": true,
  "documentVersion": "string|null",
  "publishedAt": "string|null"
}
```

---

## 15. Retrieval Strategy

Use retrieval with metadata-aware filtering.

Examples:

* user asks in Portuguese about Brazil → prioritize BR + GLOBAL
* user asks about EU compliance → prioritize EU + GLOBAL
* user asks generic accessibility question → prioritize GLOBAL first

Recommended search strategy:

* vector similarity
* optional keyword search for exact references
* optional reranking if needed

---

## 16. LLM Prompting Rules

The LLM must be used as a reasoning/generation layer, not as the primary source of truth.

### Prompt principles

* use only retrieved context
* answer in the user's language
* be explicit about uncertainty
* cite sources when available
* do not invent laws or standards
* if the answer is not supported by retrieved content, say so

Example prompt skeleton:

```text
You are an accessibility expert assistant.

Use ONLY the context below to answer the user's question.
If the answer is not clearly supported by the context, say that the information is insufficient.

Answer in the user's language.
Cite the source names and sections when available.

Context:
[chunk 1]
[chunk 2]
[chunk 3]

Question:
[user question]
```

---

## 17. Database Strategy

Recommended primary database:

* PostgreSQL

Recommended vector support:

* pgvector

Why:

* simple operational model
* good fit for challenge scope
* supports relational auth + telemetry + vector retrieval in one stack
* evaluator-friendly

Suggested logical tables:

* users
* telemetry_events
* documents
* document_chunks
* embeddings
* chat_sessions
* chat_messages

You may simplify physical modeling as needed.

---

## 18. Security and Privacy

This project handles user interaction data.

Apply data minimization.

### Rules

* never store raw passwords
* hash passwords securely
* protect all non-public endpoints with JWT
* avoid collecting unnecessary personal data
* do not collect secrets
* avoid storing sensitive message content unless justified
* document what is collected and why

Telemetry should prioritize behavioral/product signals over sensitive personal content.

If message content is stored for analytics, document the reason clearly and keep it minimal.

---

## 19. Accessibility Requirements for the UI

Because accessibility is core to the business, the frontend should reflect it.

Minimum expectations:

* semantic elements
* visible focus states
* keyboard support
* labels for form controls
* ARIA only when appropriate
* proper error messaging
* accessible contrast
* language-aware UI

---

## 20. Testing Strategy

### Backend

* unit tests for auth rules and telemetry services
* unit tests for RAG orchestration logic
* tests for DTO validation
* integration tests for critical endpoints

### Frontend

* component tests for auth and chat
* telemetry batching tests
* accessibility checks for key screens

### E2E

At least one happy-path E2E flow is a strong differential:

* signup
* login
* send message
* collect telemetry
* inspect `/data`

---

## 21. Observability

Add lightweight but useful observability.

Recommended:

* structured logs in backend
* request correlation id if possible
* log batch ingestion results
* log chat request latency
* log RAG failures separately from chat fallback

Do not overengineer this.

Keep it simple and demonstrable.

---

## 22. CI/CD

A simple GitHub Actions pipeline is enough.

Recommended pipeline:

* install dependencies
* lint
* test
* optionally build frontend and backend

Goal:

* show engineering discipline
* ensure evaluator confidence

---

## 23. Docker and Local Execution

The whole project must be easy for evaluators to run.

Target:

* one clear startup flow
* minimal manual setup
* `.env.example`
* working `docker-compose.yml`

The README must include:

* prerequisites
* how to run
* how to test
* architecture explanation
* telemetry strategy
* RAG strategy
* trade-offs and future improvements

---

## 24. Delivery Strategy

This challenge should be implemented with progressive delivery in mind.

### Phase 1

* monorepo
* auth
* chat UI
* basic `/collect`
* `/data`
* Docker
* tests

### Phase 2

* front batching
* structured telemetry taxonomy
* accessibility-focused events
* improved logging

### Phase 3

* RAG ingestion
* `/ask`
* official source retrieval
* multilingual responses
* citations

### Phase 4

* optional extras
* WebSocket chat
* richer analytics
* scoring engine
* compliance filters

This phasing is important because the project must remain deliverable even if advanced features are partially incomplete.

---

## 25. Fallback Rule

If full RAG ingestion is not ready in time:

* keep the chatbot operational
* use curated mock/fallback responses
* preserve the same `/ask` contract
* clearly document that retrieval mode is designed and partially implemented

This keeps the submission strong and honest.

---

## 26. What Good Looks Like

A strong submission demonstrates:

* thoughtful telemetry design
* clean NestJS architecture
* React frontend with accessible UX
* scalable ingestion thinking
* realistic RAG architecture
* multilingual support
* product reasoning
* clear trade-offs

---

## 27. Final Vision

This project is a **Telemetry-Driven Accessibility Intelligence Platform**.

It combines:

* authenticated chat
* behavioral telemetry
* accessibility-first frontend
* scalable ingestion
* multilingual RAG over official knowledge sources

The system should feel like a realistic product foundation, not a toy demo.

Build it with clarity, pragmatism, and strong engineering judgment.

```

---

### O que foi melhorado nessa revisão

Agora ele cobre o que faltava no anterior:

- **alinhamento total com o enunciado**
- **telemetria como centro do desafio**
- **RAG como plus realista, não como dependência absoluta**
- **fallback se a ingestão não ficar pronta**
- **batching no front**
- **alto volume no `/collect`**
- **segurança e minimização de dados**
- **testes, Docker, CI, README**
- **estratégia de entrega por fases**

Também tem um ponto importante: eu **removi aquelas citações quebradas** tipo `:contentReference[...]`, porque isso não deve entrar no `AGENTS.md`.

Se você quiser, no próximo passo eu posso te entregar também a versão final do **`README.md`** e a **estrutura inicial do monorepo** já pronta para o Codex começar a gerar código.
```

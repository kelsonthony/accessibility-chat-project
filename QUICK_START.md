# Quick Start

## Prerequisites

- Oracle SSH tunnel available through `./open-oracle-tunnels.sh`
- Local `.env` already configured with `DATABASE_URL` pointing to `accesschatdb`
- Node dependencies installed with `npm install`

## Start The Services

1. Open the Oracle tunnel:
   `./open-oracle-tunnels.sh start`
2. Start the backend:
   `npm run start --workspace @handtalk-challenge/backend`
3. Start the frontend in another terminal:
   `npm run start --workspace @handtalk-challenge/frontend`

Frontend runs at `http://127.0.0.1:3000`.
Backend runs at `http://127.0.0.1:3001`.

## Use The Frontend

1. Open `http://127.0.0.1:3000`.
2. In the left panel, create an account or log in.
3. In the center panel, ask a question about accessibility laws or standards.
4. Use the right panel actions:
   `Sync sources` seeds official source metadata.
   `Ingest chunks` writes source chunks into `accesschatdb`.
   `Flush telemetry` sends queued frontend telemetry to the backend.
   `Refresh /data` reloads persisted telemetry events.

## Recommended Demo Flow

1. Sign up with an email like `demo@accesschat.dev`.
2. Click `Sync sources`.
3. Click `Ingest chunks`.
4. Ask: `Quais requisitos da LBI devo observar no Brasil para acessibilidade?`
5. Click `Flush telemetry`.
6. Click `Refresh /data` and confirm the event list updates.

## API Collection

Import [accesschat.postman_collection.json](/Users/kelsonthony/Dev/projects/accessibility-chat-project/postman/accesschat.postman_collection.json) into Postman.

Suggested order:
1. `Health`
2. `Signup` or `Login`
3. `Sync Sources`
4. `Ingest Chunks`
5. `Ask Question`
6. `Collect Telemetry`
7. `Get Telemetry Data`

`Signup` and `Login` automatically store `token` as a collection variable.

## Notes

- The backend is using the Oracle PostgreSQL database `accesschatdb` through the SSH tunnel.
- `pgvector` is not installed on that server, so embeddings are stored as `jsonb` for now.
- If the frontend stops loading data, check the tunnel first with `./open-oracle-tunnels.sh status`.

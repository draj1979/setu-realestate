# Setu

Setu is a multi-tenant SaaS platform for real-estate builders.

## Architecture

- GCP
- Cloud SQL PostgreSQL
- Cloud Storage
- Pub/Sub
- Cloud Tasks
- Cloud Run
- Identity Platform
- Gemini
- OpenClaw

## Repository Structure

- `apps/web` — Setu builder dashboard and web application
- `apps/api` — Setu control-plane API
- `apps/worker` — asynchronous Setu workers
- `packages/db` — database layer
- `packages/types` — shared types
- `packages/config` — shared configuration
- `packages/whatsapp` — WhatsApp integration
- `openclaw/manager` — OpenClaw agent lifecycle management
- `openclaw/runtime` — OpenClaw integration
- `infrastructure/terraform` — GCP infrastructure
- `docs/architecture` — architecture documentation

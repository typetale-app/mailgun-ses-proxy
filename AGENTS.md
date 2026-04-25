# AGENTS.md

> Project context for AI coding agents working on this codebase.

## Project Overview

Mailgun-to-SES Proxy — an API server that mimics Mailgun's API endpoints while routing email sending through Amazon SES. Primarily used with Ghost CMS for newsletter delivery.

**Stack:** Next.js (API routes) + Bun runtime + Prisma (MySQL) + AWS SES + AWS SQS

## Architecture

### Entry Points
- `server.ts` — Custom HTTP server that starts Next.js and launches background SQS queue processors.
- `proxy.ts` — Next.js middleware handling both API key authentication (Basic Auth) and Dashboard session authentication (JWT).

### API Routes
- `POST /v3/[siteId]/messages` — Queues newsletter emails (Mailgun-compatible endpoint called by Ghost).
- `POST /v1/send` — Sends transactional/system emails directly via SES (direct send).
- `GET /v3/[siteId]/events` — Returns email events in Mailgun-compatible format (paginated).
- `GET /stats/[action]` — Email statistics dashboard API.
- `GET /healthcheck` — Health check endpoint.

### Newsletter Sending Pipeline
1. **Ingest** (`app/v3/[siteId]/messages/route.ts`): Ghost sends a batch → saved to `newsletterBatch` table → SQS message queued with batch DB ID.
2. **Process** (`service/background-process.ts`): Uses `startWorker` (generic SQS utility) to poll the newsletter queue.
3. **Send** (`service/newsletter-service.ts`): `validateAndSend()` receives an SQS message → `sendMail()` iterates over recipients, sends via SES, records in `newsletterMessages` table (implements idempotency).
4. **Events** (`service/events-service/index.ts`): SES delivery/bounce notifications processed via `handleNewsletterEmailEvent` (standardized event processor) and stored in `newsletterNotifications`.

### Duplicate Send Prevention & Failsafes
The system implements a multi-layered approach to prevent duplicates and handle failures:

1. **SQS Visibility Timeout (900s)**: Ensures large batches have enough time to process before SQS attempts re-delivery.
2. **Idempotency Check**: Before every send, `checkNewsletterAlreadySent()` verifies the `(batchId, toEmail)` tuple in the DB.
3. **Upsert for Events**: Notification events use `upsert` logic to remain idempotent on SQS re-deliveries.
4. **Retry Limits (3)**: The generic worker and event processor automatically discard messages that exceed 3 retry attempts to prevent infinite loops.
5. **Worker Isolation**: All background tasks use `lib/core/sqs-worker.ts` for consistent error isolation and message lifecycle management.

### Key Services & Utilities
- `lib/core/sqs-worker.ts` — Generic SQS polling utility used by all background tasks.
- `lib/core/event-processor.ts` — Factory for creating standardized SES notification handlers.
- `service/newsletter-service.ts` — Newsletter batch processing and idempotency logic.
- `service/transaction-email-service.ts` — Transactional email sending.
- `service/events-service/` — Mailgun-compatible event analytics and SES event handlers.
- `service/database/db.ts` — Centralized Prisma operations with built-in idempotency support.

### Database (Prisma + MySQL)
Key tables: `newsletterBatch`, `newsletterMessages`, `newsletterErrors`, `newsletterNotifications`, `systemMails`, `adminUser`.

## Development

- **Runtime:** Bun
- **Tests:** `bun run test` (Vitest, ~200 tests covering edge cases and performance).
- **Build:** `bun run build` (Next.js build + server compilation).

## Important Conventions

- **Security**: `DASHBOARD_JWT_SECRET` is mandatory. Default admin credentials MUST be rotated upon first login.
- **Lazy Clients**: All AWS clients are lazily initialized singletons (`service/aws/awsHelper.ts`).
- **Path Aliases**: Use `@/` for absolute imports from the project root.
- **Standardized Responses**: Use `lib/api-response.ts` for all API route returns.
- **Structured Logging**: Pino child loggers are used per service for easy traceability.


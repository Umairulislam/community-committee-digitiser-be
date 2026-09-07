# Trust Kameti — Backend

Backend API for a transparent and auditable digital committee (kameti) platform.
It digitises every stage of a rotating savings group — members, cycles, contributions, payments, lotteries, and payouts — with the backend as the single source of truth for financial data, lottery fairness, and audit history.

## Tech Stack

- **NestJS 10** (TypeScript 5) — modular REST API framework
- **PostgreSQL** with **Prisma ORM 6** — persistence and migrations
- **Redis** + **BullMQ 6** (via `@nestjs/bullmq`) — background notification queue
- **@nestjs/schedule** — daily cron jobs (contribution reminders, overdue sweep)
- **JWT authentication** (`@nestjs/jwt` + Passport `passport-jwt`), stored in an HTTP-only `jwt` cookie (`cookie-parser`); passwords hashed with **bcrypt**
- **class-validator / class-transformer** — DTO validation (whitelist + transform)
- **OpenAI Chat Completions API** (plain REST) — AI Committee Assistant
- **Jest** + ts-jest + Supertest — unit and e2e tests; **ESLint** + **Prettier** for linting/formatting

## Prerequisites

- **Node.js 20+** (project uses `@types/node` ^20)
- **PostgreSQL** (any recent version supported by Prisma 6)
- **Redis** (required at startup — the notification queue and cron jobs connect to it)

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Keys expected by the application:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string used by Prisma |
| `JWT_SECRET` | yes | secret used to sign JWTs |
| `JWT_EXPIRES_IN` | yes | JWT lifetime (e.g. `7d`; code default `7d`) |
| `COOKIE_SECURE` | yes | set `true` to issue the auth cookie only over HTTPS |
| `REDIS_HOST` | yes | Redis host for BullMQ (code default `localhost`) |
| `REDIS_PORT` | yes | Redis port for BullMQ (code default `6379`) |
| `OPENAI_API_KEY` | no | enables the AI Committee Assistant; requests return `503` when unset |
| `OPENAI_MODEL` | no | model name (code default `gpt-4o-mini`) |
| `OPENAI_BASE_URL` | no | OpenAI-compatible API base URL (code default `https://api.openai.com/v1`) |
| `OPENAI_TIMEOUT_MS` | no | request timeout in milliseconds (code default `30000`) |

> Note: `main.ts` also reads `PORT` (default `3000`) and `CORS_ORIGIN` (default `http://localhost:3000`), but these keys are **not** listed in `.env.example`.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure the environment
cp .env.example .env
# ... then edit .env with your database, Redis, and JWT values

# 3. Apply database migrations (also generates the Prisma client)
npm run prisma:migrate          # prisma migrate dev

# (optional) Regenerate the Prisma client without migrating
npm run prisma:generate

# 4. Start Redis (required before starting the app)
#    e.g. on Windows/WSL:
redis-server
#    or on Docker:
docker run -d -p 6379:6379 redis

# 5. Start the dev server
npm run start:dev
```

The API listens on `http://localhost:3000` by default.

> **Note:** there is no seed script in this repository — the database starts empty after migrations. Create the first users via `POST /auth/register` (see the API documentation).

Useful extras: `npm run prisma:studio` (database GUI), `npm run prisma:migrate:deploy` (production migrations), `npm run start:prod` (run the compiled build from `dist/`).

## Project Structure

```
src/
├── auth/           # Registration/login, JWT cookie handling, guards, passport strategy
├── users/          # User persistence service
├── committees/     # Committee CRUD and lifecycle (DRAFT → ACTIVE → ... )
├── members/        # Committee membership listing/removal, "my committees"
├── invitations/    # Email invitations with single-use tokens
├── cycles/         # Cycle generation, status transitions, start-next flow
├── contributions/  # Per-cycle contribution records, summaries, overdue marking
├── payments/       # Payment claims, admin verification/rejection
├── lotteries/      # Eligibility rules, draw execution, results and history
├── payouts/        # Winner payouts and payout status machine
├── audit/          # Audit trail queries (list + chronological timeline)
├── notifications/  # In-app notifications, BullMQ queue/processor, daily cron jobs
├── reports/        # JSON and CSV analytical reports per committee
├── ai/             # AI Committee Assistant (context builder + OpenAI client)
├── prisma/         # PrismaService and module
├── app.module.ts   # Root module wiring all feature modules
└── main.ts         # Bootstrap (validation pipe, CORS, cookie parser, port)

prisma/             # schema.prisma + SQL migrations
test/               # e2e test setup (Jest)
docs/               # Design/behaviour documents (workflows, data model, overview)
```

## Running Tests

```bash
# Unit tests (all *.spec.ts files under src/)
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# e2e tests
npm run test:e2e

# Lint
npm run lint
```

## API Documentation

Full endpoint reference — every route, DTO, response shape, and error code, with examples — lives in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

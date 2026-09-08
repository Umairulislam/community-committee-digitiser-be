# 🔐 Trust Kameti — Backend

Backend API for **Trust Kameti**, a transparent and auditable digital kameti management platform.

The backend acts as the **single source of truth** for committee data, financial records, lottery fairness, payouts, notifications, and audit history. It powers the Trust Kameti frontend through a modular REST API built with NestJS.

## 🛠️ Tech Stack

- **NestJS 10** + **TypeScript 5** — modular REST API
- **PostgreSQL** + **Prisma ORM 6** — database, schema and migrations
- **Redis** + **BullMQ 6** — background jobs and notification queues
- **@nestjs/schedule** — scheduled reminders and overdue contribution checks
- **JWT + Passport** — authentication with HTTP-only cookies
- **bcrypt** — password hashing
- **class-validator / class-transformer** — request validation and transformation
- **OpenAI API** — AI Committee Assistant
- **Jest + Supertest** — unit and end-to-end testing
- **ESLint + Prettier** — code quality and formatting

## 💡 Core Features

- User registration and authentication
- Committee and member management
- Invitation flow with secure single-use tokens
- Contribution and payment tracking
- Admin payment verification and rejection
- Committee cycle management
- Backend-controlled lottery execution
- Payout tracking and status management
- In-app notifications and automated reminders
- Audit logs and chronological activity timeline
- Committee reports in JSON and CSV
- AI Committee Assistant for authorised committee queries

## ⚙️ Prerequisites

- **Node.js 20+**
- **PostgreSQL**
- **Redis**

## 🔐 Environment Variables

Copy `.env.example` to `.env` and configure the required values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Yes | JWT lifetime, e.g. `7d` |
| `COOKIE_SECURE` | Yes | Enables secure cookies over HTTPS |
| `REDIS_HOST` | Yes | Redis host |
| `REDIS_PORT` | Yes | Redis port |
| `OPENAI_API_KEY` | No | Enables the AI Committee Assistant |
| `OPENAI_MODEL` | No | OpenAI model name |
| `OPENAI_BASE_URL` | No | OpenAI-compatible API base URL |
| `OPENAI_TIMEOUT_MS` | No | AI request timeout |

The application also supports:

```env
PORT=3000
CORS_ORIGIN=http://localhost:3000
```

## 🚀 Getting Started

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Apply database migrations:

```bash
npm run prisma:migrate
```

Start Redis:

```bash
redis-server
```

Or with Docker:

```bash
docker run -d -p 6379:6379 redis
```

Start the development server:

```bash
npm run start:dev
```

By default, the API runs at:

```text
http://localhost:3000
```

> The repository does not include a seed script. Create the first user through `POST /auth/register`.

## 📁 Project Structure

```text
src/
├── auth/           # Authentication, JWT cookies, guards and strategy
├── users/          # User persistence
├── committees/     # Committee CRUD and lifecycle
├── members/        # Membership management
├── invitations/    # Invitation flow and tokens
├── cycles/         # Committee cycle management
├── contributions/  # Contribution records and summaries
├── payments/       # Payment claims and verification
├── lotteries/      # Eligibility, draws and lottery history
├── payouts/        # Winner payouts and statuses
├── audit/          # Audit logs and activity timeline
├── notifications/  # Notifications, BullMQ jobs and cron tasks
├── reports/        # Committee reports
├── ai/             # AI Committee Assistant
├── prisma/         # Prisma service and module
├── app.module.ts
└── main.ts

prisma/             # Prisma schema and migrations
test/               # End-to-end test setup
docs/               # Project and workflow documentation
```

## 🧪 Testing

```bash
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
npm run lint
```

## 📖 API Documentation

Full API documentation, including endpoints, DTOs, response formats, validation rules, and error codes:

[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🔗 Frontend

The frontend application is built with **Next.js, TypeScript, Material UI, Redux Toolkit and RTK Query**.

**Frontend repository:**  
https://github.com/Umairulislam/trust-kameti-frontend

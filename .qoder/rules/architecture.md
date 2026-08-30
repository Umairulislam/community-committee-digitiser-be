# Backend Architecture Rules

## Architecture

* Use **NestJS modular architecture** organised by business domain.
* Keep controllers thin; they handle HTTP concerns only.
* Keep business logic inside services/use cases.
* Use Prisma only for database access.
* Use DTOs for request validation and typed API contracts.
* Use Guards for authentication and authorisation.
* Keep cross-cutting concerns in shared/common modules.

## Core Modules

Auth, Users, Committees, Members, Invitations, Cycles, Contributions, Payments, Lottery, Payouts, Notifications, Audit, Reports, AI.

## Data Flow

Client → Controller → Guard/Validation → Service → Prisma → PostgreSQL.

External integrations such as payments, Redis/BullMQ, notifications, and OpenAI must be isolated behind dedicated services/modules.

## Business Logic

* Financial, cycle, lottery, payout, and permission rules must execute on the backend.
* Do not duplicate critical business logic in controllers or frontend.
* Use database transactions for operations that update multiple related records.
* Preserve clear module boundaries and avoid circular dependencies.

## API

* Use versioned REST APIs.
* Return consistent response and error structures.
* Keep authentication and authorisation checks close to protected resources.

## Maintainability

* Prefer simple, explicit solutions.
* Avoid unnecessary abstractions and over-engineering.
* Reuse existing patterns before introducing new ones.
* New modules/features must follow the established architecture.

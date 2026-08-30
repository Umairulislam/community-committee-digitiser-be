# Community Committee Digitiser — Backend

## Project

Backend API for a transparent and auditable digital committee (kameti) platform.

## Stack

* NestJS + TypeScript
* PostgreSQL
* Prisma ORM
* REST API
* Redis + BullMQ
* JWT / HTTP-only cookies
* OpenAI API for the Committee Assistant

## Architecture

* Organise code by business domain/modules.
* Controllers handle HTTP requests only.
* Services contain business logic.
* Prisma handles database access.
* DTOs validate incoming requests.
* Guards enforce authentication and authorisation.
* Keep financial and lottery logic on the backend.

## Core Modules

Auth, Users, Committees, Members, Invitations, Cycles, Contributions, Payments, Lottery, Payouts, Notifications, Audit Logs, Reports, AI.

## Critical Business Rules

* Only authorised users can access committee data.
* The backend is the source of truth for financial data.
* The backend determines lottery eligibility and winner.
* Members who already received a payout are excluded from future lotteries.
* Lottery can only run when the cycle is eligible.
* Payout requires a valid lottery winner.
* Critical financial/lottery operations must use database transactions.
* Important changes must create audit records.
* Historical financial records must not be silently overwritten.

## Coding Rules

* Use strict TypeScript.
* Keep modules focused and maintainable.
* Prefer simple solutions over unnecessary abstraction.
* Never trust client-provided financial or authorisation decisions.
* Never expose secrets or sensitive data.
* Follow existing project conventions before introducing new patterns.

## Development Principle

Build a secure, reliable, auditable backend that directly solves the transparency and accountability problems of traditional kametis.

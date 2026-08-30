# Backend Development Rules

## NestJS

* Use NestJS modules organised by business domain.
* Keep controllers thin and focused on HTTP concerns.
* Keep business logic inside services.
* Use dependency injection throughout the application.
* Keep modules loosely coupled and avoid circular dependencies.

## DTOs & Validation

* Create DTOs for incoming request bodies, params, and query data.
* Validate all external input.
* Do not trust client-provided financial, status, role, or lottery values.
* Use clear and consistent validation/error messages.

## Database

* Use Prisma as the only application-level database access layer.
* Use PostgreSQL for persistent data.
* Keep database models and relationships consistent with the domain.
* Add database constraints for important business rules where appropriate.
* Use transactions for critical multi-record operations.

## API

* Use RESTful, versioned APIs.
* Use clear resource-based endpoint naming.
* Return consistent success and error response structures.
* Use appropriate HTTP status codes.
* Support pagination, filtering, and sorting where needed.

## Authentication & Authorisation

* Protect private endpoints with authentication guards.
* Enforce role and resource-level authorisation on the backend.
* Verify committee membership before exposing private committee data.
* Never rely on frontend route protection as security.

## Error Handling

* Fail safely and return meaningful API errors.
* Do not expose stack traces, database errors, secrets, or internal implementation details.
* Handle expected business-rule failures explicitly.

## Financial & Lottery Operations

* Perform financial calculations on the server.
* Verify payment state before updating contributions.
* Validate cycle state before lottery or payout operations.
* Use database transactions for lottery, payout, and related audit updates.
* Prevent duplicate financial or lottery operations.

## External Services

* Isolate Redis, BullMQ, payment providers, notification providers, and OpenAI behind dedicated services/modules.
* Store credentials and API keys in environment variables.
* Never hard-code secrets.

## Code Quality

* Use strict TypeScript.
* Prefer readable and explicit code over clever abstractions.
* Reuse existing project patterns.
* Avoid unnecessary dependencies.
* Keep functions and services focused on one responsibility.
* Add tests for important business logic and edge cases.

## Changes

Before implementing a feature:

1. Check existing modules and patterns.
2. Identify affected business rules and database models.
3. Update related tests and types.
4. Avoid changing unrelated functionality.

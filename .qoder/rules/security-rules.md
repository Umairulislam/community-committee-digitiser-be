# Security Rules

## Authentication

* Protect all private endpoints with authentication guards.
* Store authentication credentials/tokens securely; never expose them to client-side JavaScript unnecessarily.
* Hash passwords using a secure password-hashing algorithm such as Argon2 or bcrypt.
* Never log passwords, tokens, API keys, or other secrets.

## Authorisation

* Enforce authorisation on the backend, never only in the frontend.
* Verify both the user's role and their access to the requested resource.
* A user can access only committees and financial records they are authorised to access.
* Admin access must be limited to committees they are authorised to manage.

## Input & API Security

* Validate and sanitise all external input.
* Never trust client-provided IDs, roles, amounts, statuses, ownership, or permissions.
* Prevent mass-assignment by explicitly controlling accepted fields.
* Apply rate limiting to authentication and other sensitive endpoints.

## Financial Security

* Never trust payment success/status values sent by the frontend.
* Verify payment information through trusted backend/payment-provider data.
* Calculate financial totals on the server.
* Protect payment, contribution, and payout records from unauthorised modification.
* Use database transactions for critical financial operations.

## Lottery Security

* Lottery eligibility must be calculated by the backend.
* The frontend must never select or submit the winner.
* Previous successful payout recipients must be excluded according to business rules.
* Prevent duplicate or repeated lottery execution for the same cycle.
* Store the lottery result and audit event atomically.

## Data Protection

* Return only the data required by the requesting user.
* Never expose passwords, secrets, internal tokens, or unnecessary personal data.
* Do not expose sensitive database or infrastructure details in API responses.
* Use HTTPS in deployed environments.

## Secrets & Configuration

* Keep secrets in environment variables or a secure secret manager.
* Never commit `.env` files or credentials to source control.
* Provide a safe `.env.example` containing variable names only.

## Logging & Auditing

* Log security-relevant events without exposing sensitive information.
* Important financial, administrative, lottery, and permission changes must create audit records.
* Audit records must not be silently deleted or modified.

## AI Security

* Never give the AI direct unrestricted database access.
* Retrieve only data the authenticated user is authorised to access.
* Do not send unnecessary personal or sensitive data to the AI provider.
* Treat AI output as informational; it must not override backend business rules or permissions.

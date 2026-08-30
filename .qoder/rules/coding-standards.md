# Coding Standards

## TypeScript

* Use strict TypeScript.
* Avoid `any`; use proper types, interfaces, or generics.
* Prefer explicit types for public APIs and important business logic.
* Use enums/constants for fixed domain values where appropriate.

## Naming

* Use `PascalCase` for classes, DTOs, modules, and interfaces/types where appropriate.
* Use `camelCase` for variables, functions, methods, and properties.
* Use descriptive names that reflect the business domain.
* Avoid unclear abbreviations.

## NestJS Structure

* Keep each module focused on one business domain.
* Controllers handle HTTP concerns only.
* Services contain business logic.
* DTOs handle request validation.
* Keep reusable cross-cutting utilities in appropriate common modules.

## Database & Prisma

* Keep Prisma queries close to the relevant domain service/repository layer.
* Avoid unnecessary database queries.
* Select only required fields when returning sensitive or large datasets.
* Use transactions for related operations that must succeed or fail together.

## Error Handling

* Use NestJS exceptions and consistent API error responses.
* Handle expected business-rule failures explicitly.
* Never expose internal stack traces or database implementation details.

## Code Quality

* Prefer simple, readable solutions.
* Avoid premature abstraction and over-engineering.
* Keep functions and classes focused.
* Reuse existing utilities and patterns before creating new ones.
* Remove unused code, imports, and dependencies.

## Comments

* Write comments only when they explain non-obvious business or technical decisions.
* Do not add comments that simply restate the code.

## Testing

* Add unit tests for important business logic.
* Test critical cases such as:

  * Authentication and authorisation
  * Payment state changes
  * Cycle transitions
  * Lottery eligibility and execution
  * Payout rules
* Add integration/e2e tests for important API workflows.

## API Consistency

* Keep endpoint naming, DTOs, response formats, validation, and error handling consistent across modules.
* Do not introduce a new API pattern when an existing project pattern already exists.

## Maintainability

* Follow the existing project structure and conventions.
* Make the smallest reasonable change required for a feature or bug fix.
* Do not modify unrelated code.
* New code must remain compatible with the established architecture and business rules.

# Business Rules

## Committee

* A committee contains a fixed group of members and runs for a defined number of cycles.
* Each member contributes a fixed amount per cycle.
* The expected pool is based on the committee contribution rules.
* Committee statuses: `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`.

## Members

* A member must belong to the committee to access its data.
* Members can be active, inactive, invited, or removed.
* Removed/inactive members must not participate in future cycles or lotteries unless explicitly allowed by the business rules.

## Contributions

* Each active member has one contribution record per cycle.
* A contribution has an amount, due date, and status.
* Contribution statuses: `PENDING`, `PAID`, `OVERDUE`.
* Duplicate contribution records for the same member and cycle are not allowed.
* The backend calculates and validates contribution amounts.

## Payments

* A payment represents an actual payment transaction for a contribution.
* Payment data must be verified before marking a contribution as paid.
* Financial status must never be trusted from the frontend.
* Important payment changes must be recorded in the audit log.

## Cycles

* A committee contains sequential cycles.
* Only one cycle can be active at a time.
* A cycle must satisfy its contribution requirements before the lottery can run.
* Completed cycles must not be silently modified or reopened.

## Lottery

* The backend exclusively determines the lottery winner.
* Lottery can run only when the cycle is eligible.
* Only eligible active members can participate.
* Members who have already received a completed payout are excluded from future lotteries.
* A cycle can have only one lottery result.
* A lottery result cannot be silently replaced.
* The lottery result must include the cycle, winner, timestamp, and relevant audit information.

## Payouts

* A payout is created only after a valid lottery winner exists.
* Each cycle has at most one final payout.
* Payout amount must follow the committee rules.
* Payout statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
* Completed payouts must remain part of the permanent history.

## Audit Trail

* Important business actions must create an audit record.
* Audit records should capture:

  * Who performed the action
  * What happened
  * When it happened
  * Committee
  * Cycle
* Historical financial, lottery, and payout records must not be silently deleted or overwritten.

## Notifications

* Important events may trigger notifications.
* Examples: contribution reminder, payment confirmation, lottery completion, payout completion, and committee invitation.
* Notification generation must not alter the underlying financial records.

## General Rules

* The backend is the source of truth.
* Never allow frontend input to decide financial totals, lottery eligibility, lottery winners, or payout validity.
* Critical multi-step financial and lottery operations must use database transactions.
* Business rules must be enforced consistently across all API endpoints.

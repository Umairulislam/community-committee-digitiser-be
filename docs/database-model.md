# Database Model

## Overview

PostgreSQL is the primary persistent data store.

Prisma is used as the application ORM.

The database models should represent the committee domain and maintain strong relationships and constraints.

## Core Entities

```text
User
Committee
CommitteeMember
Invitation

Cycle
Contribution
Payment

LotteryResult
Payout

Notification
AuditLog
```

## User

Represents an authenticated person.

Core fields:

```text
id
name
email
phone
passwordHash
role
status
createdAt
updatedAt
```

Roles:

```text
USER
ADMIN
```

## Committee

Represents a rotating savings group.

Core fields:

```text
id
name
description
contributionAmount
memberLimit
totalCycles
payoutMethod
startDate
dueDay
status
createdBy
createdAt
updatedAt
```

Payout method:

```text
LOTTERY
```

Bidding is currently out of scope.

## CommitteeMember

Connects users with committees.

Core fields:

```text
id
committeeId
userId
role
status
joinedAt
removedAt
createdAt
updatedAt
```

A user may belong to multiple committees.

## Invitation

Represents a committee invitation.

Core fields:

```text
id
committeeId
invitedBy
email/phone
token
status
expiresAt
acceptedAt
createdAt
```

## Cycle

Represents one committee round.

Core fields:

```text
id
committeeId
cycleNumber
startDate
endDate
status
totalExpected
totalCollected
createdAt
updatedAt
```

Cycle status must follow controlled state transitions.

## Contribution

Represents what a member is expected to contribute for a cycle.

Core fields:

```text
id
cycleId
memberId
amount
dueDate
status
paidAt
paymentId
createdAt
updatedAt
```

Rules:

* One contribution per member per cycle.
* Duplicate records are not allowed.
* Amount is determined by backend business rules.

## Payment

Represents the actual payment transaction.

Core fields:

```text
id
contributionId
memberId
amount
transactionReference
status
paidAt
verifiedAt
createdAt
updatedAt
```

Payment represents the financial event; contribution represents the member's obligation.

## LotteryResult

Represents the final lottery result for a cycle.

Core fields:

```text
id
cycleId
winnerMemberId
eligibleMemberCount
executedAt
executedBy
createdAt
```

Rules:

* One final result per cycle.
* Winner must be eligible.
* Previous completed payout recipients are excluded.
* Lottery execution must be atomic.
* Result must be auditable.

## Payout

Represents money awarded to the cycle winner.

Core fields:

```text
id
cycleId
memberId
amount
status
paidAt
reference
createdAt
updatedAt
```

Rules:

* Payout requires a valid winner.
* One final payout per cycle.
* Completed payout becomes part of permanent history.

## Notification

Represents a message delivered to a user.

Core fields:

```text
id
userId
type
title
message
read
createdAt
```

## AuditLog

Represents an immutable historical event.

Core fields:

```text
id
actorId
action
entityType
entityId
committeeId
cycleId
metadata
createdAt
```

Audit records should answer:

```text
Who?
What?
When?
Which committee?
Which cycle?
```

## Relationships

```text
User
 │
 ├───────────────┐
 │               │
 ▼               ▼
CommitteeMember  Notification
 │
 ▼
Committee
 │
 ├── CommitteeMember
 ├── Invitation
 └── Cycle
      │
      ├── Contribution
      │      │
      │      └── Payment
      │
      ├── LotteryResult
      │
      └── Payout

Committee / Cycle
       │
       ▼
   AuditLog
```

## Important Constraints

The database should enforce important uniqueness and integrity constraints where appropriate.

Examples:

```text
One membership per user/committee
One contribution per member/cycle
One lottery result per cycle
One final payout per cycle
```

Foreign keys must preserve valid relationships.

## Financial Integrity

Financial values should use appropriate precise database types such as PostgreSQL numeric/decimal rather than floating-point types.

Financial records should not be silently deleted or overwritten.

Corrections should be represented through controlled state changes and audit events.

## Transactions

Use database transactions for operations where multiple changes must succeed together.

Critical examples:

```text
Run Lottery
    ↓
Create LotteryResult
    ↓
Create Payout
    ↓
Update Cycle
    ↓
Create AuditLog
    ↓
Commit
```

If any critical operation fails, the transaction should roll back.

## Data Access Principle

The backend must enforce ownership and authorisation before returning committee, payment, contribution, payout, or audit data.

The database is the persistent source of truth; the frontend must not be treated as authoritative.

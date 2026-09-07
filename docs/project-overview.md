# Trust Kameti — Project Overview

## Purpose

Trust Kameti is a digital platform for managing informal rotating savings groups (kametis).

It replaces trust-based, paper/WhatsApp processes with a transparent and auditable system for managing members, contributions, cycles, lottery-based payouts, payments, notifications, and records.

## Core Problem

Traditional committees commonly rely on:

* WhatsApp messages
* Notebooks/registers
* Cash payments
* Manual calculations
* Verbal agreements
* One organiser maintaining records

This creates:

* No reliable payment history
* Missed or unclear contributions
* Heavy dependence on the organiser
* Difficulty tracking payouts
* Disputes about payments and records
* Lack of transparency and accountability

## Solution

The platform creates a central digital record for every important committee event.

Core flow:

`Committee → Members → Cycles → Contributions → Payments → Lottery → Payout → Audit Trail`

The backend is the source of truth for all business and financial operations.

## User Roles

### User / Member

A member can:

* Register and authenticate
* View their committees
* View committee information
* View members
* Track contributions
* Make/pay contributions
* View payment history
* View payout information
* View lottery results
* View committee timeline
* Receive notifications
* Use the AI Committee Assistant

### Admin

An administrator can:

* Create and manage committees
* Configure committee rules
* Invite, view, and remove members
* Manage contributions and payments
* Verify payments
* Send payment reminders
* Manage cycles
* Run the lottery
* Manage payouts
* Manage committee status
* View audit history
* Send notifications
* Generate reports
* Manage committee settings

## Committee Model

A committee contains:

* A fixed or configured group of members
* A contribution amount
* A defined number of cycles
* A payment schedule
* A payout method

The current product supports **lottery-based payout selection**.

Bidding is not part of the current product scope.

## Lottery

The backend determines the lottery winner.

Rules:

* Lottery can only run when the cycle is eligible.
* Only eligible active members can participate.
* Members who already received a completed payout are excluded.
* Each cycle has one final lottery result.
* Lottery results are permanently recorded.
* Lottery execution must create an audit record.

## Financial Flow

Each cycle produces contribution records for members.

```text
Expected Contribution
        ↓
Payment
        ↓
Payment Verification
        ↓
Contribution Marked Paid
        ↓
Cycle Ready
        ↓
Lottery
        ↓
Payout
```

Financial decisions and calculations must be performed by the backend.

## Auditability

The system must maintain a reliable history of important actions.

Audit records should capture:

* Who performed the action
* What happened
* When it happened
* Which committee was affected
* Which cycle was affected

Financial, lottery, payout, and administrative records must not be silently overwritten or deleted.

## AI Feature

The application contains exactly one AI-powered feature:

### AI Committee Assistant

The assistant allows authenticated users to ask natural-language questions about committee information they are authorised to access.

Examples:

* "How much have I contributed?"
* "When is my next payment?"
* "When is my payout?"
* "Who won the last lottery?"

The AI must never make business decisions, determine lottery winners, or bypass backend authorisation.

## Committee Statuses

```text
DRAFT
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

## Backend Stack

* NestJS
* TypeScript
* PostgreSQL
* Prisma ORM
* REST API
* Redis
* BullMQ
* JWT / HTTP-only cookies
* OpenAI API

## Backend Architecture

Use modular domain-driven NestJS architecture.

Core modules:

```text
Auth
Users
Committees
Members
Invitations
Cycles
Contributions
Payments
Lottery
Payouts
Notifications
Audit
Reports
AI
```

General request flow:

`Client → Controller → Validation/Guards → Service → Prisma → PostgreSQL`

## Project Boundaries

The backend is responsible for:

* Authentication and authorisation
* Business rules
* Financial calculations
* Payment state
* Cycle state
* Lottery eligibility and winner selection
* Payout state
* Audit records
* Notifications
* Secure AI data access

The frontend is responsible for presentation and user interaction only.

## Primary Goal

Build a simple, secure, reliable, and auditable digital committee system that reduces dependence on trust and manual record-keeping while giving members and administrators a clear source of truth.

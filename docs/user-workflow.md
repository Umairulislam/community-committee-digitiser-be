# User Workflow

## 1. Registration & Login

```text
Register
  ↓
Account Created
  ↓
Login
  ↓
Authenticated User
  ↓
Dashboard
```

Users provide basic account information such as name, email/phone, and password.

## 2. Dashboard

The dashboard provides a quick view of the user's current committee activity:

* Active committees
* Total paid
* Outstanding contribution
* Next payment
* Next payout
* Important notifications

The dashboard should prioritise actions that need the user's attention.

## 3. My Committees

Users can view all committees they belong to.

Each committee should show:

* Name
* Member count
* Contribution amount
* Current cycle
* Payout method
* Status

```text
My Committees
    ↓
Select Committee
    ↓
Committee Details
```

## 4. Committee Details

A user can view:

```text
Overview
Contributions
Members
Payout
Timeline
```

The user should only see information they are authorised to access.

## 5. Contribution Tracking

For the current cycle:

```text
Contribution Amount
Due Date
Status
Payment Action
```

Example:

```text
Rs. 10,000
Due: 05 Sep
Status: PENDING

→ Pay Contribution
```

After successful payment:

```text
Status: PAID
Paid Date: 29 Aug
Transaction ID: TXN-12345
```

## 6. Payment History

Users can view their contribution history by cycle.

```text
Cycle 1    Rs. 10,000    PAID
Cycle 2    Rs. 10,000    PAID
Cycle 3    Rs. 10,000    PAID
Cycle 4    Rs. 10,000    PENDING
```

Payment details may include:

* Amount
* Cycle
* Date
* Status
* Transaction reference

## 7. Members

Users can see the committee members and relevant membership/payment status information permitted by the application.

The frontend must not expose private financial information unnecessarily.

## 8. Payout Tracking

The user can see:

* Expected payout cycle
* Expected amount
* Payout method
* Current payout status

Example:

```text
Expected Cycle: 7
Expected Amount: Rs. 100,000
Method: Lottery
Status: Upcoming
```

## 9. Lottery

The user can view lottery information for completed or relevant cycles.

Example:

```text
Cycle #4
Lottery Completed

Winner: Ahmed Khan
Payout: Rs. 100,000
Date: 29 Aug 2026
```

The client never selects or determines the winner.

The backend is responsible for:

* Eligibility
* Excluding previous winners
* Random selection
* Result persistence

## 10. Committee Timeline

Users can view important committee events:

```text
Contribution Received
        ↓
Cycle Completed
        ↓
Lottery Conducted
        ↓
Winner Selected
        ↓
Payout Recorded
```

This provides transparency without requiring users to inspect individual records manually.

## 11. Notifications

Users receive notifications for important events:

* Contribution due
* Payment recorded
* Payment overdue
* Lottery completed
* Payout recorded
* Committee invitation
* Cycle updates

## 12. AI Committee Assistant

The application contains one AI feature:

```text
User Question
      ↓
Backend Authorisation
      ↓
Retrieve permitted committee data
      ↓
AI Assistant
      ↓
Natural-language answer
```

Example questions:

```text
"How much have I paid?"
"When is my next payment?"
"When is my payout?"
"Who won the last lottery?"
```

The AI can explain available data but cannot:

* Decide financial outcomes
* Select lottery winners
* Change records
* Bypass permissions

## 13. Profile

Users can manage:

* Name
* Phone (including clearing it)

Both users and admins read their own profile with `GET /auth/me` and update it
with `PATCH /auth/me`. Email remains read-only. Notification preferences are not
currently supported by the database schema.

See [Profile Management API](../API_DOCUMENTATION.md#patch-authme) for validation and examples.

## Overall User Flow

```text
LOGIN
  ↓
DASHBOARD
  ↓
MY COMMITTEES
  ↓
COMMITTEE DETAILS
  │
  ├── CONTRIBUTIONS
  │       ↓
  │    PAYMENT
  │       ↓
  │    PAYMENT HISTORY
  │
  ├── MEMBERS
  │
  ├── PAYOUT
  │
  └── TIMELINE

AI ASSISTANT
    ↕
User's authorised committee data

NOTIFICATIONS
    ↓
Important committee events
```

# Admin Workflow

## 1. Authentication

```text
Admin Login
    ↓
Authenticate credentials
    ↓
Create authenticated session
    ↓
Admin Dashboard
```

Admin authentication and authorisation must be enforced by the backend.

## 2. Dashboard

The dashboard provides an operational overview:

* Active committees
* Total members
* Pending contributions
* Upcoming payouts
* Action-required items
* Recent activity

Example action:

```text
Family Committee
3 members have not paid
→ Review Committee
```

## 3. Committee Management

Admin can:

* View committees they manage
* Filter by status
* Create a committee
* View committee details
* Update permitted settings
* Pause or complete a committee

Committee statuses:

```text
DRAFT
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

## 4. Create Committee

Creation flow:

```text
Basic Information
      ↓
Financial Rules
      ↓
Payout Method
      ↓
Schedule
      ↓
Review
      ↓
Create Committee
```

Required configuration includes:

* Committee name
* Contribution amount
* Member capacity
* Number of cycles
* Payout method
* Start date
* Contribution due date
* Cycle schedule
* Applicable late-payment rules

Current payout method:

```text
LOTTERY
```

Bidding is not part of the current product.

## 5. Member Management

After committee creation:

```text
Create Committee
      ↓
Invite Members
      ↓
Member Accepts
      ↓
Member Joins Committee
```

Admin can:

* Invite members
* View members
* Remove members
* View membership status

## 6. Contribution Management

For each cycle, the admin can view:

* Member
* Expected amount
* Due date
* Payment status

Example:

```text
Ahmed     Rs. 10,000    PAID
Bilal     Rs. 10,000    PAID
Umair     Rs. 10,000    PAID
Hamza     Rs. 10,000    PENDING
```

## 7. Payment Verification

Payment flow:

```text
Payment Submitted / Received
          ↓
Payment Verification
          ↓
Verified
          ↓
Contribution = PAID
```

The backend must verify payment state and must not trust a status submitted by the client.

Important payment changes create audit records.

## 8. Payment Reminders

Admin can send reminders to:

* A specific member
* Members with pending contributions
* Eligible committee members

Example:

```text
3 members have not paid
→ Send Reminder
```

Automated reminders may also be triggered by scheduled jobs.

## 9. Cycle Management

Admin can view cycle status:

```text
Cycle 1    COMPLETED
Cycle 2    COMPLETED
Cycle 3    ACTIVE
Cycle 4    UPCOMING
```

A cycle moves through controlled states and cannot skip required business steps.

## 10. Lottery Management

Lottery flow:

```text
Cycle
 ↓
Check cycle eligibility
 ↓
Check required contributions
 ↓
Find eligible members
 ↓
Exclude previous payout recipients
 ↓
Select random winner
 ↓
Save lottery result
 ↓
Create payout
 ↓
Create audit event
 ↓
Notify members
```

Important rules:

* Backend exclusively determines the winner.
* Admin cannot manually choose a winner.
* A member with a completed previous payout is excluded.
* A cycle can have only one final lottery result.
* Lottery execution must be atomic.
* The result must be permanently auditable.

## 11. Payout Management

After lottery:

```text
Winner Selected
      ↓
Payout Created
      ↓
Payout Processing
      ↓
Payout Completed
      ↓
Member Notified
```

Payout should contain:

* Winner
* Cycle
* Amount
* Status
* Date
* Reference

## 12. Committee Timeline

The timeline presents important committee events chronologically:

```text
Committee Created
      ↓
Members Joined
      ↓
Contributions Recorded
      ↓
Cycle Completed
      ↓
Lottery Conducted
      ↓
Winner Selected
      ↓
Payout Recorded
```

## 13. Audit Logs

Every important action should record:

```text
Who
What
When
Committee
Cycle
```

Examples:

```text
COMMITTEE_CREATED
MEMBER_INVITED
PAYMENT_VERIFIED
LOTTERY_EXECUTED
PAYOUT_COMPLETED
COMMITTEE_PAUSED
```

Audit records are historical evidence and must not be silently changed.

## 14. Notifications

Admin can create notifications:

```text
Audience
Message
Send
```

Notifications may also be triggered automatically by system events.

## 15. Reports

Admin can view committee summaries such as:

* Total members
* Total expected contributions
* Total collected
* Outstanding amount
* Completed cycles
* Payouts

Reports can be exported when required.

## 16. Settings

Admin can manage permitted committee settings:

* Contribution amount
* Due date
* Payout method
* Cycle duration
* Late-payment rules
* Notification preferences

Changes to important financial settings should be validated and audited.

## Overall Admin Flow

```text
LOGIN
  ↓
DASHBOARD
  ↓
COMMITTEE
  ↓
MEMBERS
  ↓
CYCLE
  ↓
CONTRIBUTIONS
  ↓
PAYMENT VERIFICATION
  ↓
CYCLE READY
  ↓
LOTTERY
  ↓
WINNER
  ↓
PAYOUT
  ↓
AUDIT
  ↓
NOTIFICATION
  ↓
NEXT CYCLE
```

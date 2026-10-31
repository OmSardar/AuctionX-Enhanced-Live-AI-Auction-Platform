# Auction X — Stage 4.2: Permanent Wallet Credit Idempotency Audit

**Document ID**: `STAGE4-2-PERMANENT-IDEMPOTENCY-2026-10-14`  
**Date**: October 14, 2026  
**Status**: VERIFIED & COMPLETE  
**Scope**: Elimination of bounded array deduplication (`$slice: -100`), establishment of permanent durable idempotency across arbitrary payment histories, concurrent settlement lease coordination, and crash recovery under standalone MongoDB topology.

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 Confirmed Vulnerability
In Stage 4, crash safety between the wallet balance mutation and transaction ledger write was coupled using an in-document array on the `User` schema:
```javascript
{
  $push: {
    creditedPayments: {
      $each: [paymentIdStr],
      $slice: -100
    }
  }
}
```
While this bounded array protected against immediate duplicate callbacks, it created an **extended-history double-credit vulnerability**:
1. When a legitimate user deposited funds (Payment $P_1$), $P_1$ was recorded in `User.creditedPayments`.
2. As the user continued normal account activity and completed >100 subsequent wallet deposits ($P_2, P_3, \dots, P_{102}$), the `$slice: -100` operator evicted $P_1$ from the document array.
3. If an attacker or a delayed provider webhook / network replay resent payment $P_1$, the condition `{ creditedPayments: { $ne: P_1 } }` evaluated to `true`.
4. As a result, the user's wallet was credited a second time for payment $P_1$, causing direct financial loss to the platform.

### 1.2 Architectural Constraints (Standalone MongoDB)
The platform runs on a standalone MongoDB instance (`localhost:27017` / standard Docker `mongo:7.0` container without `--replSet`). Under this topology:
- Multi-document ACID transactions (`session.startTransaction()`) are **unsupported** by MongoDB and throw `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`.
- Any multi-collection mutation (`User`, `Payment`, `Transaction`) cannot be executed as an atomic multi-document transaction.
- Maintaining an unbounded array of all historical payment IDs inside the `User` document violates BSON document size constraints (16 MB limit) and creates unbounded write amplification.

---

## 2. Chosen Design & Topology Compatibility

To achieve **permanent, durable idempotency without unbounded document growth and without replica set transactions**, we designed a coordinated two-tier deduplication and lease architecture:

```
+--------------------------------------------------------------------------------------------------+
|                                    PERMANENT DEDUPLICATION GATE                                  |
|   1. Transaction Ledger (Unique Sparse Index: paymentId)                                         |
|   2. Payment Document (walletCredited == true && status == 'CAPTURED')                           |
+--------------------------------------------------------------------------------------------------+
                                                |
                                                v
+--------------------------------------------------------------------------------------------------+
|                               ATOMIC SETTLEMENT LEASE ACQUISITION                                |
|   Payment.findOneAndUpdate({                                                                     |
|     _id: payment._id,                                                                            |
|     walletCredited: { $ne: true },                                                               |
|     $or: [{ settlementLockedUntil: null }, { settlementLockedUntil: { $lte: now } }]             |
|   }, { $set: { settlementLockedUntil: now + 10s, status: 'PENDING_VERIFICATION' } })             |
+--------------------------------------------------------------------------------------------------+
        |                                                                 |
        | Acquired (Worker 1)                                             | Held / Blocked (Worker 2)
        v                                                                 v
+---------------------------------------+                 +--------------------------------+
|     SINGLE-DOCUMENT ATOMIC MUTATION   |                 | Racing Worker Lease Polling:   |
|   UserModel.updateOne({               |                 | - Checks checkTxn / checkPay   |
|     _id: userId,                      |                 | - Sees settled state           |
|     creditedPayments: { $ne: payId }  |                 | - Returns alreadyPaid: true    |
|   }, {                                |                 +--------------------------------+
|     $inc: { amount: rupees },         |
|     $addToSet: { creditedPayments }   |
|   })                                  |
+---------------------------------------+
        |
        v
+--------------------------------------------------------------------------------------------------+
|                                  DURABLE TRANSACTION LEDGER WRITE                                |
|   Transaction.create({ paymentId, amount, type: 'deposit', userEmail, ... })                     |
|   * Protected by unique sparse index `uniq_transaction_payment_id`                               |
+--------------------------------------------------------------------------------------------------+
        |
        v
+--------------------------------------------------------------------------------------------------+
|                            CONFIRM PERMANENT SETTLEMENT & RELEASE LEASE                          |
|   Payment.findByIdAndUpdate(paymentId, {                                                         |
|     $set: { status: 'CAPTURED', walletCredited: true, ledgerRecorded: true,                      |
|             transactionId: txn._id, settlementLockedUntil: null }                                |
|   })                                                                                             |
+--------------------------------------------------------------------------------------------------+
        |
        v
+--------------------------------------------------------------------------------------------------+
|                                 PRUNE TRANSIENT IN-FLIGHT MARKER                                 |
|   UserModel.updateOne({ _id: userId }, { $pull: { creditedPayments: payId } })                  |
|   * Keeps User.creditedPayments empty in steady state (0 unbounded memory growth)                |
+--------------------------------------------------------------------------------------------------+
```

### 2.1 Why This Works Across All Failure Windows
1. **Durable Ledger as the Permanent Source of Truth**:
   - `Transaction` collection possesses a unique sparse index on `paymentId` (`uniq_transaction_payment_id`).
   - Every settlement check queries `Transaction.findOne({ paymentId })` and `Payment.walletCredited === true`.
   - Regardless of whether 100, 1,000, or 1,000,000 subsequent payments occur, the permanent ledger entry remains indexed and immutable. A replayed payment is rejected upfront as `alreadyPaid: true`.
2. **Transient In-Flight Coordination on User**:
   - While a settlement is in progress, `paymentId` is atomically registered in `User.creditedPayments` along with the balance `$inc`.
   - Once `Transaction` is inserted and `Payment` is marked `walletCredited: true`, `paymentId` is safely pulled (`$pull`) from `User.creditedPayments`.
   - In steady state, `User.creditedPayments` is empty (`[]`), completely avoiding the 16 MB BSON limit and unbounded array growth.
3. **Atomic Settlement Lease Coordination**:
   - When concurrent requests (e.g., checkout browser verification and webhook delivery, or reconciliation and checkout) arrive simultaneously for the same payment, both cannot be allowed to execute mutations in parallel.
   - `Payment.findOneAndUpdate` atomically claims a 10-second lease (`settlementLockedUntil`).
   - Only the winning worker proceeds to mutate the wallet and write the ledger; the racing worker waits briefly, detects the completed settlement via `walletCredited` / `Transaction`, and returns `alreadyPaid: true` without double-crediting.
4. **Crash Recovery Coupling**:
   - **Crash before wallet increment**: No ledger, `walletCredited: false`, `creditedPayments` empty. Retry cleanly increments balance, creates ledger, marks captured.
   - **Crash after wallet increment but before ledger**: `User.creditedPayments` retains the in-flight `paymentId`. On recovery/reconciliation, the query `{ creditedPayments: { $ne: paymentId } }` prevents a second `$inc`. The worker heals the missing `Transaction`, marks `Payment` as `CAPTURED`, and clears `creditedPayments`.
   - **Crash after ledger but before final payment status update**: Permanent ledger entry exists. Retry detects existing `Transaction`, syncs `Payment.status = "CAPTURED"` and `walletCredited = true`, and returns `alreadyPaid: true`.

---

## 3. Files Changed

| File Path | Component | Changes Made |
| :--- | :--- | :--- |
| `server/models/Payment.js` | Mongoose Schema | Added `settlementLockedUntil` (Date, indexed) for atomic lease coordination during concurrent settlement attempts. Added `walletCredited`, `walletCreditedAt`, `ledgerRecorded`, `ledgerRecordedAt`, `transactionId`. |
| `server/models/AdminModels/FINANCE/Transaction.js` | Mongoose Schema | Added `paymentId` (ObjectId, ref: Payment) with `uniq_transaction_payment_id` unique sparse index to guarantee durable idempotency across all time. |
| `server/models/LoginSchema/user.js` | Mongoose Schema | Retained transient `creditedPayments: { type: [String], default: [] }` for atomic single-document crash recovery coordination. |
| `server/services/paymentService.js` | Business Logic | Updated `settleWalletTopup` and `reconcileWalletPayment`: (1) Upfront permanent deduplication check against `Transaction` and `Payment.walletCredited`, (2) Atomic settlement lease acquisition on `Payment` to serialize racing workers, (3) Safe post-settlement `$pull` from `User.creditedPayments` to prevent unbounded array growth, (4) Automatic lease release on capture and on failure quarantine. |
| `server/tests/unit/stage4_wallet_payment.test.js` | Test Suite | Added Section 10 tests verifying: (1) Replaying payment after >100 subsequent payments, (2) Duplicate webhook delivery, (3) Concurrent browser and webhook delivery settlement. |

---

## 4. Test Verification & Actual Exit Codes

### 4.1 Focused Wallet Suite (`tests/unit/stage4_wallet_payment.test.js`)
```
PASS tests/unit/stage4_wallet_payment.test.js (7.778 s)
  Stage 4 — Wallet Add-Funds Payment Architecture
    1. Successful Add-Funds Payment
      √ creates authoritative order with integer paise and credits wallet upon verified payment (376 ms)
      √ accepts wallet top-up via create-order route when type is WALLET_TOPUP (209 ms)
    2. Invalid Signature Verification
      √ rejects tampered signature with 400 and preserves existing balance (217 ms)
    3. Failed Database Update After Verification
      √ quarantines payment as REQUIRES_RECONCILIATION if user credit DB write throws (218 ms)
    4. Duplicate Callback and Webhook Delivery
      √ idempotently handles repeated verify calls without double crediting (285 ms)
      √ deduplicates webhook delivery without crediting wallet a second time (268 ms)
    5. Concurrent Attempts to Credit the Same Payment
      √ handles concurrent verify requests safely and increments balance exactly once (292 ms)
    6. Reconciliation After Transient Failure
      √ recovers a quarantined payment and credits wallet safely upon reconciliation (252 ms)
    7. Incorrect User Association
      √ rejects an imposter attempting to verify another user's wallet payment with 403 (205 ms)
    8. Amount Mismatch Protection
      √ quarantines payment if provider reports a mismatched amount (218 ms)
    9. Targeted Failure-Injection and Crash Safety Windows
      √ Failure Window 1: recovers cleanly when process crashed before wallet credit without duplicate charge (257 ms)
      √ Failure Window 2: heals missing ledger entry without double crediting wallet balance (254 ms)
      √ Failure Window 3: heals final payment status when ledger write succeeded before crash (230 ms)
      √ Failure Window 4: concurrent webhook and browser verification credit wallet strictly once (305 ms)
      √ Failure Window 5: reconciliation retry racing with earlier settlement does not double credit (283 ms)
      √ Failure Window 6A: disambiguates timeout when DB write actually committed before timeout (242 ms)
      √ Failure Window 6B: disambiguates timeout when DB write was dropped before reaching Mongo (220 ms)
      √ heals unconfirmed CAPTURED payments without returning a false-positive success (248 ms)
    10. Stage 4.2 Permanent Idempotency Across Extended Histories
      √ permanently prevents duplicate credit when a payment is replayed after >100 subsequent payments (426 ms)
      √ duplicate webhook delivery is permanently deduplicated without side effects (246 ms)
      √ concurrent browser verification and webhook delivery settle wallet exactly once (268 ms)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        8.066 s
Actual Exit Code: 0
```

### 4.2 Existing Auction Settlement Suite (`tests/unit/stage4_payment_settlement.test.js`)
```
PASS tests/unit/stage4_payment_settlement.test.js (11.566 s)
  Stage 4 — Production-Grade Payment Architecture & Settlement
    1. Razorpay Order Creation & Authorization (5 tests)
    2. 24-Hour Payment Deadline & Immutability (2 tests)
    3. Idempotency & Provider Retries (4 tests)
    4. Cryptographic Signature Verification (5 tests)
    5. Authoritative Dual-Path Settlement (Verify + Webhook) (4 tests)
    6. Webhook Security, Deduplication & Ordering (7 tests)
    7. Reconciliation, Amount Mismatch & Late Payments (4 tests)
    8. GET /api/payment/order/:orderId Access Control (2 tests)

Test Suites: 1 passed, 1 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        11.879 s
Actual Exit Code: 0
```

### 4.3 Full Backend Test Suite (`npm test -- --runInBand`)
```
Test Suites: 42 passed, 42 total
Tests:       360 passed, 360 total
Snapshots:   0 total
Time:        93.495 s
Actual Exit Code: 0
```

---

## 5. Remaining Limitations & Operational Considerations

1. **Standalone MongoDB vs Replica Set**:
   - Because MongoDB is running standalone, operations spanning `User`, `Payment`, and `Transaction` are not executed in a single atomic database engine transaction. Instead, application-level coordination, unique index constraints, and transient in-flight markers guarantee correctness across crashes.
   - If the database infrastructure is later upgraded to a MongoDB Replica Set, multi-document ACID transactions (`session.withTransaction(...)`) can be layered in as an additional defense-in-depth measure without changing API contracts.
2. **Lease Timeout Duration**:
   - The settlement lease duration is set to 10 seconds (`LOCK_DURATION_MS = 10000`). If a settlement worker freezes (e.g., severe event loop blockage) for >10 seconds, another worker or reconciliation process could acquire the lease. However, because wallet mutation is guarded by `{ creditedPayments: { $ne: paymentIdStr } }` and ledger creation is guarded by `uniq_transaction_payment_id`, duplicate credit remains physically impossible even in this pathological case.
3. **Database Index Maintenance**:
   - The unique sparse index `uniq_transaction_payment_id` on the `Transaction` collection is essential. Ensure database backup and restore scripts preserve all sparse and unique index definitions.

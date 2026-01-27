# Affiliate API — Frontend Reference

Base: `/api`

Quick reference for frontend developers integrating affiliate flows.

**Auth**
- Public endpoints: no auth required.
- Affiliate endpoints: authenticated user (Bearer token).
- Admin endpoints: admin role required (Bearer token with admin privileges).

**Referral link format**
```
https://example.com/product/{slug}?ref={referral_code}
```

---

## Public

- **POST /affiliate/track** : Track referral click
  - Auth: none
  - Body (JSON):
    - `referralCode` (string) — referral code from URL `ref` query
    - `productId` (number) — optional product id or slug
    - `sessionId` (string) — optional session identifier for dedupe
    - `ip` (string) — optional (server may derive from request)
  - Example request:

```json
{ "referralCode": "ikclsmvf", "productId": 10, "sessionId": "sess-abc123" }
```

  - Success response 200:

```json
{ "success": true, "tracked": true, "clickId": "cmkwpoblz..." }
```

  - Errors:
    - 429 Too Many Requests — rate limit (30 clicks/min per IP)
    - 400 Bad Request — missing referralCode

Notes: click tracking is deduplicated per session per link.

- **POST /affiliate/apply** : Apply to become an affiliate
  - Auth: Bearer token (user must be logged in)
  - Body (JSON):
    - `email` (string) — contact email for payout notifications
    - `payoutMethod` (string, optional) — "paypal", "bank_transfer", etc.
    - `payoutDetails` (object, optional) — provider-specific payout details
    - `notes` (string, optional) — motivation or additional info
  - Example request:

```json
{
  "email": "affiliate@example.com",
  "payoutMethod": "paypal",
  "payoutDetails": { "paypal_email": "payments@example.com" },
  "notes": "I'd like to promote your products on my blog."
}
```

  - Success response 201:

```json
{
  "id": "app_123",
  "userId": 42,
  "email": "affiliate@example.com",
  "status": "pending",
  "createdAt": "2026-01-27T16:03:47.000Z"
}
```

  - Errors:
    - 401 Unauthorized — not logged in
    - 400 Bad Request — user already has affiliate account or pending application

- **GET /affiliate/application/status** : Check application status
  - Auth: Bearer token (user must be logged in)
  - Response 200:

```json
{
  "id": "app_123",
  "userId": 42,
  "status": "pending",
  "email": "affiliate@example.com",
  "createdAt": "2026-01-27T16:03:47.000Z"
}
```

Or if no application:

```json
{ "status": "not_applied" }
```

---

## Authenticated (Affiliate)

All affiliate endpoints require `Authorization: Bearer <token>` for the affiliate user.

- **GET /affiliate/profile**
  - Returns affiliate account details for current user.
  - Response 200:
```json
{ "affiliate": { "id": "aff_123", "userId": "usr_456", "defaultCommissionRate": 0.05, "status": "active" } }
```

- **GET /affiliate/links**
  - Returns list of referral links owned by the affiliate.
  - Query params: `page`, `limit`
  - Response 200: `{ "links": [ { "id": "link_1", "productId": 10, "code": "ikclsmvf", "url": "https://...", "commissionRate": 0.05, "active": true } ] }`

- **POST /affiliate/links**
  - Create referral link for a product.
  - Body:
```json
{ "productId": 10, "commissionRate": 0.05, "expiresAt": "2026-12-31T23:59:59Z" }
```
  - Response 201:
```json
{ "id": "link_1", "code": "ikclsmvf", "url": "https://example.com/product/awesome-widget?ref=ikclsmvf" }
```

- **DELETE /affiliate/links/:id**
  - Deactivate a referral link (soft-delete).
  - Response 204 No Content on success.

- **GET /affiliate/stats**
  - Earnings statistics (period summary).
  - Query params: `from`, `to`
  - Response 200: `{ "earnings": { "pendingCents": 1500, "approvedCents": 7500, "paidCents": 0 } }`

- **GET /affiliate/commissions**
  - Commission history.
  - Query params: `status`, `page`, `limit`
  - Response 200: `{ "commissions": [ { "id": "c_1", "orderId": "ord_1", "amountCents": 1500, "status": "pending", "createdAt": "..." } ], "meta": { "page": 1 } }`

- **GET /affiliate/payouts**
  - Payout history for affiliate.
  - Response 200: `{ "payouts": [ { "id": "p_1", "amountCents": 7500, "status": "pending", "createdAt": "..." } ] }`

- **GET /affiliate/clicks**
  - Click history with pagination and filters.
  - Query params: `from`, `to`, `page`, `limit`
  - Response 200: `{ "clicks": [ { "id": "click_1", "productId": 10, "sessionId": "sess-1", "createdAt": "..." } ] }`

---

## Admin

Admin endpoints require an admin token.

- **GET /admin/affiliate/applications**
  - List affiliate applications
  - Query params: `status` (pending, approved, rejected), `page`, `limit`
  - Response 200: `{ "data": [ { "id": "app_1", "userId": 42, "email": "...", "status": "pending", "createdAt": "..." } ], "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 } }`

- **GET /admin/affiliate/applications/:id**
  - Get application details
  - Response 200: `{ "id": "app_1", "userId": 42, "email": "...", "status": "pending", "notes": "...", "createdAt": "..." }`

- **PATCH /admin/affiliate/applications/:id/approve**
  - Approve application and create affiliate account
  - Body: `{ "defaultCommissionRate": 0.05, "payoutMethod": "paypal", "payoutDetails": {...}, "adminNotes": "Approved" }`
  - Response 200: `{ "id": "aff_123", "userId": 42, "status": "active", "defaultCommissionRate": 0.05 }`

- **PATCH /admin/affiliate/applications/:id/reject**
  - Reject application
  - Body: `{ "adminNotes": "Does not meet requirements" }`
  - Response 200: `{ "id": "app_1", "userId": 42, "status": "rejected", "adminNotes": "..." }`

- **GET /admin/affiliate/affiliates**
  - List all affiliates
  - Query params: `page`, `limit`, `status`
  - Response 200: `{ "affiliates": [ { "id": "aff_1", "userId": "usr_1", "status": "active" } ] }`

- **GET /admin/affiliate/affiliates/:id**
  - Get affiliate details and stats.

- **POST /admin/affiliate/affiliates**
  - Create affiliate account for a user.
  - Body: `{ "userId": "usr_123", "defaultCommissionRate": 0.05, "payoutEmail": "pay@affiliate.com" }`
  - Response 201: `{ "id": "aff_123" }`

- **PATCH /admin/affiliate/affiliates/:id**
  - Update affiliate (e.g., commission rate, payout info).

- **POST /admin/affiliate/affiliates/:id/suspend**
  - Suspend affiliate (prevents new commissions).
  - Response 200: `{ "status": "suspended" }`

- **GET /admin/affiliate/commissions**
  - List commissions across program with filters (status, affiliateId, date range).

- **POST /admin/affiliate/payout**
  - Create payout batch from approved commissions.
  - Body: `{ "commissionIds": ["c_1","c_2"] , "method": "paypal", "note": "April payout" }`
  - Response 201: `{ "batchId": "batch_1", "amountCents": 9000 }`

- **POST /admin/affiliate/payout/:batchId/mark-paid**
  - Mark payout batch as paid after external payment.
  - Body: `{ "paymentReference": "payment_ref_12345" }`
  - Response 200: `{ "batchId": "batch_1", "status": "paid" }`

- **POST /admin/affiliate/payout/:batchId/mark-failed**
  - Mark payout batch as failed. Body: `{ "reason": "insufficient_funds" }`

- **GET /admin/affiliate/stats**
  - Program-wide statistics.

---

## Common notes for frontend

- Referral link: append `?ref={code}` to product URLs; the public `track` endpoint should be called on page visit (or via image beacon) to record clicks.
- Click deduplication: one click per session per link — pass a stable `sessionId` from the frontend if available (cookie/localStorage).
- Rate limiting: public tracking endpoint rate-limited (e.g., 30/min per IP). Expect 429 from server if exceeded.
- Self-purchase: frontend may optionally hide affiliate inputs if the buyer is the affiliate owner — server enforces the block.
- Idempotency: commissions are idempotent by `idempotencyKey = {orderId}:{orderItemId}:{affiliateId}` — frontend does not need to set this, server handles it.
- Timezones & dates: server responses use ISO8601 UTC strings.

---

## Sample curl

Track click (public):

```bash
curl -X POST https://api.example.com/api/affiliate/track \
  -H "Content-Type: application/json" \
  -d '{"referralCode":"ikclsmvf","productId":10,"sessionId":"sess-123"}'
```

Create link (affiliate):

```bash
curl -X POST https://api.example.com/api/affiliate/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":10,"commissionRate":0.05}'
```

---

## Error codes (common)

- `400` — Bad request / validation error
- `401` — Unauthorized (missing/invalid token)
- `403` — Forbidden (accessing admin endpoint without admin role)
- `404` — Resource not found
- `409` — Conflict (duplicate link code)
- `429` — Too many requests

---

If you want, I can: add OpenAPI snippets, generate example TypeScript fetch wrappers, or add a link to this file from docs/INDEX.md.

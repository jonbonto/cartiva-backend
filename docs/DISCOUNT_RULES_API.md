**Discount Rule Admin API**

Base path: `/api/admin/discount-rules`

Endpoints

 - `POST /api/admin/discount-rules`
  - Purpose: Create a discount rule.
  - Body (JSON):
    - `code` (string|null) - optional coupon code (e.g., `SAVE10`)
    - `type` ("percentage" | "fixed_amount") - discount kind
    - `value` (number) - percent for `percentage` (e.g., `10`), or cents for `fixed_amount` (e.g., `500`)
    - `appliesTo` (string) - scope (`cart_wide`, `specific_product`, `category`)
    - `targetProductIds` (number[]) - optional product ids
    - `minCartValueCents` (number|null) - optional min cart value in cents
    - `isStackable` (boolean) - whether rule stacks with others
    - `priority` (number) - higher applied first
    - `isActive` (boolean) - active flag
    - `expiresAt` (ISO date|null) - optional expiry
  - Response (201): Discount rule object (domain shape)

 - `GET /api/admin/discount-rules`
  - Purpose: List discount rules (admin view)
  - Query: none
  - Response (200): Array of discount rule objects

 - `GET /api/admin/discount-rules/:id`
  - Purpose: Get a single discount rule by id
  - Response (200): Discount rule object or 404

 - `PUT /api/admin/discount-rules/:id`
  - Purpose: Update a discount rule
  - Body (partial): any updatable fields from create
  - Response (200): Updated discount rule object

 - `DELETE /api/admin/discount-rules/:id`
  - Purpose: Delete a discount rule
  - Response (204): no content

Domain / Response shape (simplified)

- `id`: string
- `code`: string | null
- `type`: "percentage" | "fixed_amount"
- `value`: number (percent or cents)
- `appliesTo`: string
- `targetProductIds`: number[]
- `minCartValueCents`: number | null
- `maxUsageCount`: number | null
- `usageCount`: number
- `isStackable`: boolean
- `priority`: number
- `isActive`: boolean
- `expiresAt`: ISO timestamp | null
- `createdAt`, `updatedAt`

Examples

Request:

```json
{
  "code": "SAVE10",
  "type": "percentage",
  "value": 10,
  "appliesTo": "cart_wide",
  "isStackable": false,
  "priority": 10,
  "isActive": true
}
```

Response (200):

```json
{
  "id": "cuid_xxx",
  "code": "SAVE10",
  "type": "percentage",
  "value": 10,
  "appliesTo": "cart_wide",
  "targetProductIds": [],
  "minCartValueCents": null,
  "maxUsageCount": 1000,
  "usageCount": 0,
  "isStackable": false,
  "priority": 10,
  "isActive": true,
  "expiresAt": null,
  "createdAt": "2026-01-16T00:00:00.000Z",
  "updatedAt": "2026-01-16T00:00:00.000Z"
}
```

Notes

- Admin endpoints are under the `admin/` prefix and should be protected by admin auth guard.
- `fixed_amount` `value` is expressed in cents to avoid floating-point rounding.
- When seeding, two example rules are created: `SAVE10` (10% off) and `FIVEOFF` ($5 off when cart >= $20).

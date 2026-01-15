# Admin Endpoints (Post-Refactor)

This document lists all administrative HTTP endpoints and the files where each admin controller now lives after the Phase 5 refactor.

Notes
- Controllers have been moved so each domain owns its admin surface (payments, shipping, tax, inventory, orders, products).
- Many admin endpoints are protected by JWT + AdminGuard.
- Some controllers still contain legacy Prisma code guarded by feature flags; services live under the corresponding domain `admin/services` folders.

Endpoints

- Products (Admin dashboard)
  - GET  /api/admin/products
  - GET  /api/admin/products/:id
  - POST /api/admin/products
  - PUT  /api/admin/products/:id
  - PATCH /api/admin/products/:id/deactivate
  - File: src/admin/admin.controller.ts

- Orders (Admin)
  - GET  /api/admin/orders
  - GET  /api/admin/orders/:id
  - POST /api/admin/orders/search
  - POST /api/admin/orders/:id/refund
  - GET  /api/admin/orders/:id/refunds
  - File: src/orders/admin/admin-orders.controller.ts
  - Service: src/orders/admin/admin-orders.service.ts

- Webhooks (Payment provider webhook admin)
  - GET  /api/admin/webhooks/failed
  - GET  /api/admin/webhooks/:webhookId
  - POST /api/admin/webhooks/:webhookId/replay
  - GET  /api/admin/webhooks
  - File: src/payments/admin/webhook-admin.controller.ts
  - Logger/service: src/payments/webhook-logger.service.ts

- Tax Rules (Admin)
  - GET    /api/admin/tax-rules
  - POST   /api/admin/tax-rules
  - PATCH  /api/admin/tax-rules/:id
  - DELETE /api/admin/tax-rules/:id
  - File: src/tax/admin/tax-rules.controller.ts
  - Service: src/tax/admin/services/tax-rules-admin.service.ts

- Shipping Methods (Admin)
  - GET    /api/admin/shipping-methods
  - POST   /api/admin/shipping-methods
  - PATCH  /api/admin/shipping-methods/:id
  - DELETE /api/admin/shipping-methods/:id
  - File: src/shipping/admin/shipping-methods.controller.ts
  - Service: src/shipping/admin/services/shipping-methods-admin.service.ts

- Inventory Reservations (Admin)
  - GET   /api/admin/reservations
  - GET   /api/admin/reservations/stats
  - PATCH /api/admin/reservations/:id/release
  - File: src/inventory/admin/reservations.controller.ts
  - Service: src/inventory/inventory-reservations-admin.service.ts

Other admin-like endpoints (non-`/api/admin` paths)
- Queue monitor: `/admin/queues` — controller: src/queues/queue-monitor.controller.ts (admin UI for queues)
- Admin order fulfillment endpoints: `api/admin/orders/:id/fulfillment` — controller: src/fulfillment/fulfillment.controller.ts

How to keep this document accurate
- When moving an admin controller, update this file with the new path and endpoint list.
- If you enable the service-layer feature flag for a domain (e.g., `tax_service_layer`), confirm the admin controller delegates to the new service and update the service path above.

Completed migration tasks referenced
- Phase 5: Clean Up Admin Module — moved controllers into domain modules and reduced `AdminModule` surface.

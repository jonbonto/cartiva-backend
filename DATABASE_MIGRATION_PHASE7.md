# Phase 7 - Database Migration Guide

## Migration Commands

After updating the Prisma schema, run these commands to apply database changes:

```bash
# Generate Prisma client with new models
npm run prisma:generate

# Create and apply migration
npx prisma migrate dev --name add_fulfillment_and_analytics

# Verify migration
npx prisma migrate status
```

## Schema Changes

### Order Model Enhancements
- `fulfillmentStatus`: Default "pending", tracks shipment lifecycle
- `shippingProvider`: Optional shipping carrier name
- `trackingNumber`: Optional tracking identifier
- `shippedAt`: Timestamp when order shipped
- `deliveredAt`: Timestamp when order delivered
- Index on `fulfillmentStatus` for fast filtering

### New Analytics Snapshot Model
- Stores pre-aggregated metrics (daily/hourly)
- Revenue, order counts, refund totals
- Provider breakdown (JSON)
- Fulfillment metrics
- Unique constraint on (date, granularity) prevents duplicates
- Indexes for fast querying by date/granularity

## Data Migration (Optional)

If you have existing orders, you may want to set default fulfillment status:

```sql
-- Set fulfillment status for existing orders
UPDATE "Order"
SET "fulfillmentStatus" = 
  CASE
    WHEN status = 'FULFILLED' THEN 'delivered'
    WHEN status = 'PAID' THEN 'processing'
    WHEN status = 'CANCELLED' THEN 'cancelled'
    ELSE 'pending'
  END
WHERE "fulfillmentStatus" IS NULL;
```

## Verification

After migration, verify the schema:

```bash
# Check tables exist
npx prisma studio

# Or use psql:
psql $DATABASE_URL -c "\d Order"
psql $DATABASE_URL -c "\d AnalyticsSnapshot"
```

## Rollback (if needed)

```bash
# Rollback last migration
npx prisma migrate reset

# Or specific migration
npx prisma migrate resolve --rolled-back <migration_name>
```

## Production Deployment

1. Backup database before migration
2. Run migration during low-traffic window
3. Verify data integrity post-migration
4. Monitor application logs for errors
5. Have rollback plan ready

```bash
# Production migration (non-interactive)
npx prisma migrate deploy
```

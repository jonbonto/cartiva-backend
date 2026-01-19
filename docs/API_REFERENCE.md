# API Reference

This document summarizes the main API endpoints for user shipping addresses, payment methods, and checkout integration.

## Authentication
- All protected endpoints require a Bearer JWT token in `Authorization` header.

## Users - Shipping Addresses

### GET /api/users/me/addresses
- Description: List all active shipping addresses owned by the authenticated user.
- Query: `?active=true|false` (optional)
- Response: 200 JSON array of address objects.

### POST /api/users/me/addresses
- Description: Create a new shipping address for the authenticated user.
- Body: CreateAddressDto
  - `fullName` (string, required)
  - `streetLine1` (string, required)
  - `streetLine2` (string, optional)
  - `city` (string, required)
  - `stateProvince` (string, required)
  - `postalCode` (string, required)
  - `country` (string, required, ISO 3166-1 alpha-2)
  - `phoneNumber` (string, optional)
  - `label` (string, optional)
- Response: 201 JSON shipping address (masked where appropriate).

### GET /api/users/me/addresses/:id
- Description: Get a single address owned by the user.
- Response: 200 JSON or 404/403.

### PUT /api/users/me/addresses/:id
- Description: Update address fields (partial allowed via DTO).
- Constraints: Cannot update addresses referenced by active orders.
- Response: 200 JSON updated address.

### DELETE /api/users/me/addresses/:id
- Description: Soft-delete address. If default, moves default to another active address.
- Response: 204 No Content.

### PATCH /api/users/me/addresses/:id/default
- Description: Set this address as the user's default.
- Response: 200 JSON updated address.

## Users - Payment Methods

### GET /api/users/me/payment-methods
- Description: List saved payment methods (masked). Provider token IDs are never returned.
- Response: 200 JSON array.

### POST /api/users/me/payment-methods
- Description: Add a tokenized payment method (provider token required).
- Body: `provider`, `providerTokenId`, optional metadata
- Response: 201 JSON masked payment method.

### GET /api/users/me/payment-methods/:id
- Description: Get a single saved payment method (masked).

### DELETE /api/users/me/payment-methods/:id
- Description: Soft-delete a saved payment method.
- Response: 204 No Content.

### PATCH /api/users/me/payment-methods/:id/default
- Description: Set as default payment method.

## Orders / Checkout Integration

### POST /api/orders/checkout
- Description: Create an order from cart or direct items.
- Body options:
  - `cartId` (number) — legacy cart flow
  - `currency` (string) — required
  - `shippingAddress` (object) — inline address (legacy)
  - `shippingAddressId` (string) — reference to saved address (requires feature flag `USER_SAVED_ADDRESSES_AT_CHECKOUT`)
  - `shippingMethodId` (string)
  - `discountCodes` (array)
- Behavior:
  - If `shippingAddressId` provided and the feature flag `USER_SAVED_ADDRESSES_AT_CHECKOUT` is enabled, the Orders controller will resolve the saved address via `UsersService` and copy it into the immutable ShippingAddress snapshot used by orders.
  - If feature flag is disabled or `UsersService` not available, inline `shippingAddress` is used or checkout proceeds without a saved address.
- Response: 200 JSON order summary.

### POST /api/orders/:id/payment
- Description: Initiate payment for an order. If `paymentMethodId` is supplied (user-saved method), payments module will read the provider token from Users service and use it to create the provider-specific charge.
- Body: `provider` (string), optional `paymentMethodId` (string)
- Notes:
  - If `paymentMethodId` is provided the caller MUST be an authenticated user and must own the order.
  - The payments module will resolve the saved payment method via `UsersService`, retrieve the provider token (never exposed in API responses), and pass it to the payment provider to create/confirm the payment.
  - If the saved method is inactive or not found, the request returns 400.

## Feature Flags
- `USER_SHIPPING_ADDRESS` — enable users endpoints for shipping addresses
- `USER_PAYMENT_METHOD` — enable users endpoints for payment methods
- `USER_SAVED_ADDRESSES_AT_CHECKOUT` — enable orders to resolve `shippingAddressId` at checkout


## Notes
- All endpoints are subject to authorization guards; users may only access their own data.
- No raw card data is ever stored; payment methods store provider token references only.


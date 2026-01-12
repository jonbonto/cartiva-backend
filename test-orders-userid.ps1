# Test Orders with userId implementation
# Ensures all orders require userId

$baseUrl = "http://localhost:3001"

Write-Host "=== Testing Orders with userId ===" -ForegroundColor Cyan

# 1. Register user
Write-Host "`n1. Registering test user..." -ForegroundColor Yellow
$registerResponse = Invoke-WebRequest -Uri "$baseUrl/auth/register" -Method POST `
  -ContentType "application/json" `
  -Body @{
    name = "Test User"
    email = "order-test@example.com"
    password = "test123"
  } | ConvertFrom-Json

$token = $registerResponse.token
$userId = $registerResponse.user.id

Write-Host "✓ User registered: ID=$userId" -ForegroundColor Green
Write-Host "✓ Token: $($token.substring(0,20))..." -ForegroundColor Green

# 2. Create cart
Write-Host "`n2. Creating cart..." -ForegroundColor Yellow
$cartResponse = Invoke-WebRequest -Uri "$baseUrl/api/cart/initialize" -Method POST `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $token" } `
  -Body @{
    sessionId = "test-session-$(Get-Random)"
  } | ConvertFrom-Json

$cartId = $cartResponse.id
Write-Host "✓ Cart created: ID=$cartId" -ForegroundColor Green

# 3. Add product to cart (need to get a product first)
Write-Host "`n3. Getting products..." -ForegroundColor Yellow
$productsResponse = Invoke-WebRequest -Uri "$baseUrl/api/products?take=1" -Method GET | ConvertFrom-Json
$productId = $productsResponse.items[0].id

Write-Host "✓ Product found: ID=$productId" -ForegroundColor Green

Write-Host "`n4. Adding product to cart..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$baseUrl/api/cart/$cartId/items" -Method POST `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $token" } `
  -Body @{
    productId = $productId
    quantity = 1
  } | Out-Null

Write-Host "✓ Product added to cart" -ForegroundColor Green

# 5. Checkout (create order with userId)
Write-Host "`n5. Creating order (checkout)..." -ForegroundColor Yellow
$checkoutResponse = Invoke-WebRequest -Uri "$baseUrl/api/orders/checkout" -Method POST `
  -ContentType "application/json" `
  -Headers @{ "Authorization" = "Bearer $token" } `
  -Body @{
    cartId = $cartId
    currency = "USD"
  } | ConvertFrom-Json

$orderId = $checkoutResponse.id
Write-Host "✓ Order created: ID=$orderId" -ForegroundColor Green

# 6. Get order and verify userId
Write-Host "`n6. Fetching order details..." -ForegroundColor Yellow
$orderDetailsResponse = Invoke-WebRequest -Uri "$baseUrl/api/orders/$orderId" -Method GET `
  -Headers @{ "Authorization" = "Bearer $token" } | ConvertFrom-Json

Write-Host "✓ Order details retrieved" -ForegroundColor Green
Write-Host "  - Order ID: $($orderDetailsResponse.id)"
Write-Host "  - User ID: $($orderDetailsResponse.userId)" -ForegroundColor Cyan
Write-Host "  - Currency: $($orderDetailsResponse.currency)"
Write-Host "  - Status: $($orderDetailsResponse.status)"
Write-Host "  - Final Total: $($orderDetailsResponse.finalTotal)"

# Verify userId is set correctly
if ($orderDetailsResponse.userId -eq $userId) {
  Write-Host "`n✅ SUCCESS: Order has correct userId!" -ForegroundColor Green
} else {
  Write-Host "`n❌ FAILED: Order userId mismatch! Expected: $userId, Got: $($orderDetailsResponse.userId)" -ForegroundColor Red
}

# 7. Test without authentication (should fail)
Write-Host "`n7. Testing checkout without token (should fail)..." -ForegroundColor Yellow
try {
  Invoke-WebRequest -Uri "$baseUrl/api/orders/checkout" -Method POST `
    -ContentType "application/json" `
    -Body @{
      cartId = $cartId
      currency = "USD"
    } -ErrorAction Stop | Out-Null
  Write-Host "❌ FAILED: Should have been rejected without token!" -ForegroundColor Red
} catch {
  Write-Host "✓ Correctly rejected: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan

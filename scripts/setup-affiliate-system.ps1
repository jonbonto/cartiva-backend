#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup script for the Affiliate System (Phase 8)

.DESCRIPTION
    This script applies the database migration for the affiliate system
    and regenerates the Prisma client.

.EXAMPLE
    .\setup-affiliate-system.ps1
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Affiliate System Setup (Phase 8)     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Generate Prisma Client
Write-Host "[1/3] Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Prisma client generated successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Create migration
Write-Host "[2/3] Creating database migration..." -ForegroundColor Yellow
npx prisma migrate dev --name add_affiliate_system

if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Migration may have failed. Check the output above." -ForegroundColor Yellow
    Write-Host "If this is a fresh setup, try running: npx prisma migrate deploy" -ForegroundColor Yellow
}
else {
    Write-Host "✓ Migration created and applied successfully" -ForegroundColor Green
}
Write-Host ""

# Step 3: Verify schema
Write-Host "[3/3] Verifying schema..." -ForegroundColor Yellow
npx prisma validate

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Schema validation failed" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Schema validated successfully" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!                      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The Affiliate System is now ready to use." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the development server: npm run start:dev"
Write-Host "  2. Create an affiliate account via admin API"
Write-Host "  3. Test referral link creation and tracking"
Write-Host ""
Write-Host "Documentation: docs/features/AFFILIATE_SYSTEM.md" -ForegroundColor Cyan

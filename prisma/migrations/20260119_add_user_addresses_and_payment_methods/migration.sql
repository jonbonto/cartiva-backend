-- CreateTable UserShippingAddress
CREATE TABLE "UserShippingAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "streetLine1" TEXT NOT NULL,
    "streetLine2" TEXT,
    "city" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "UserShippingAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable UserPaymentMethod
CREATE TABLE "UserPaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTokenId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "last4Digits" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "cardholderName" TEXT,
    "billingStreetLine1" TEXT,
    "billingStreetLine2" TEXT,
    "billingCity" TEXT,
    "billingStateProvince" TEXT,
    "billingPostalCode" TEXT,
    "billingCountry" TEXT,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for UserShippingAddress
CREATE INDEX "UserShippingAddress_userId_idx" ON "UserShippingAddress"("userId");
CREATE INDEX "UserShippingAddress_isActive_idx" ON "UserShippingAddress"("isActive");
CREATE INDEX "UserShippingAddress_deletedAt_idx" ON "UserShippingAddress"("deletedAt");
CREATE UNIQUE INDEX "UserShippingAddress_userId_isDefault_key" ON "UserShippingAddress"("userId", "isDefault") WHERE "isDefault" = true;

-- Indexes for UserPaymentMethod
CREATE INDEX "UserPaymentMethod_userId_idx" ON "UserPaymentMethod"("userId");
CREATE INDEX "UserPaymentMethod_provider_idx" ON "UserPaymentMethod"("provider");
CREATE INDEX "UserPaymentMethod_isActive_idx" ON "UserPaymentMethod"("isActive");
CREATE UNIQUE INDEX "UserPaymentMethod_userId_isDefault_key" ON "UserPaymentMethod"("userId", "isDefault") WHERE "isDefault" = true;

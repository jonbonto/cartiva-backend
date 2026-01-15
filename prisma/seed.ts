import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminCount = await prisma.user.count()
  const productCount = await prisma.product.count()

  if (adminCount === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin'
      }
    })
    console.log('Seeded admin user: admin@example.com / admin123')
  }

  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          name: 'Wireless Mouse',
          description: 'Comfortable wireless mouse with precision tracking',
          priceInCents: 1999, // $19.99
          stock: 50,
          imageUrl: null
        },
        {
          name: 'Mechanical Keyboard',
          description: 'Tactile mechanical keyboard with RGB lighting',
          priceInCents: 8999, // $89.99
          stock: 30,
          imageUrl: null
        },
        {
          name: 'USB-C Hub',
          description: 'Multiport USB-C hub with HDMI and card reader',
          priceInCents: 3450, // $34.50
          stock: 75,
          imageUrl: null
        },
        {
          name: 'Noise Cancelling Headphones',
          description: 'Over-ear headphones with active noise cancellation',
          priceInCents: 12900, // $129.00
          stock: 20,
          imageUrl: null
        },
        {
          name: 'Webcam 1080p',
          description: 'HD webcam for streaming and video calls',
          priceInCents: 4999, // $49.99
          stock: 40,
          imageUrl: null
        }
      ]
    })
    console.log('Seeded products')
  }

  // Seed tax rules for Phase 6
  const taxCount = await prisma.taxRule.count()
  if (taxCount === 0) {
    await prisma.taxRule.createMany({
      data: [
        {
          country: 'US',
          state: null,
          city: null,
          taxRatePercent: 7.5,
          taxRateDecimal: (7.5 / 100).toFixed(4),
          isActive: true,
        },
        {
          country: 'US',
          state: 'CA',
          city: null,
          taxRatePercent: 8.25,
          taxRateDecimal: (8.25 / 100).toFixed(4),
          isActive: true,
        },
        {
          country: 'AU',
          state: null,
          city: null,
          taxRatePercent: 10.0,
          taxRateDecimal: (10.0 / 100).toFixed(4),
          isActive: true,
        },
      ],
    })
    console.log('Seeded tax rules')
  }

  // Seed shipping methods
  const shipCount = await prisma.shippingMethod.count()
  if (shipCount === 0) {
    await prisma.shippingMethod.createMany({
      data: [
        {
          name: 'Standard',
          description: 'Economical ground shipping',
          baseCostCents: 500,
          perKgCostCents: 200,
          perKmCostCents: 0,
          minWeightGrams: 0,
          maxWeightGrams: null,
          minDeliveryDays: 3,
          maxDeliveryDays: 7,
          allowedCountries: [],
          isActive: true,
        },
        {
          name: 'Express',
          description: 'Faster delivery with tracking',
          baseCostCents: 1500,
          perKgCostCents: 500,
          perKmCostCents: 0,
          minWeightGrams: 0,
          maxWeightGrams: null,
          minDeliveryDays: 1,
          maxDeliveryDays: 3,
          allowedCountries: ['US', 'CA'],
          isActive: true,
        },
        {
          name: 'Free Promotion',
          description: 'Free shipping promotion (US only)',
          baseCostCents: 0,
          perKgCostCents: 0,
          perKmCostCents: 0,
          minWeightGrams: 0,
          maxWeightGrams: null,
          minDeliveryDays: 5,
          maxDeliveryDays: 10,
          allowedCountries: ['US'],
          isActive: true,
        },
      ],
    })
    console.log('Seeded shipping methods')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

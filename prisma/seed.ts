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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

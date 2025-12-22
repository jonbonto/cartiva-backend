# E-commerce Backend (NestJS + Prisma + JWT Auth)

Complete backend for an e-commerce application with JWT authentication, product management, and cart functionality.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create/update `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ecomm?schema=public"
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
```

### 3. Setup database

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4. Start development server

```bash
npm run start:dev
```

Server will run on `http://localhost:3000`

## Authentication

### JWT-based Authentication

The system uses JWT tokens for authentication. Tokens can be:
- Sent as Bearer token in Authorization header: `Authorization: Bearer <token>`
- Sent as `jwt` cookie (auto-set on login/signup)

### Seeded Admin Credentials

```
Email: admin@example.com
Password: admin123
Role: admin
```

### Auth Endpoints

#### POST /api/auth/signup
Register a new user.

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "user": {
    "id": 2,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  },
  "token": "eyJhbGc..."
}
```

#### POST /api/auth/login
Login with email and password.

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

#### GET /api/auth/me
Get current logged-in user (requires JWT).

#### POST /api/auth/logout
Logout (clears JWT cookie).

## API Endpoints

### Public Endpoints

#### GET /api/products
Get all active products with pagination support.

Response:
```json
[
  {
    "id": 1,
    "name": "Wireless Mouse",
    "description": "...",
    "price": "19.99",
    "stock": 50,
    "imageUrl": null,
    "isActive": true,
    "createdAt": "2025-12-22T15:39:18.268Z",
    "updatedAt": "2025-12-22T15:39:18.268Z"
  }
]
```

#### GET /api/products/:id
Get a single product by ID.

#### GET /api/cart
Get current session cart.

#### POST /api/cart/items
Add item to cart.

```json
{
  "productId": 1,
  "quantity": 2
}
```

#### PUT /api/cart/items/:id
Update cart item quantity.

```json
{
  "quantity": 3
}
```

#### DELETE /api/cart/items/:id
Remove item from cart.

### Admin Endpoints (Protected - Require JWT with admin role)

#### GET /api/admin/products
List all products (admin view, includes inactive products).

#### GET /api/admin/products/:id
Get product details by ID.

#### POST /api/admin/products
Create a new product. Supports multipart/form-data for image upload.

```json
{
  "name": "New Product",
  "description": "Product description",
  "price": "29.99",
  "stock": 100,
  "imageUrl": "https://example.com/image.jpg"
}
```

Or with file upload:
- Field: `image` (multipart file)
- Other fields as JSON

#### PUT /api/admin/products/:id
Update product by ID. Supports multipart/form-data for image upload.

#### DELETE /api/admin/products/:id
Delete product by ID.

## Database Schema

### User
- `id`: Integer (PK)
- `name`: String
- `email`: String (Unique)
- `password`: String (hashed with bcrypt)
- `role`: String ("admin" | "user")
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Product
- `id`: Integer (PK)
- `name`: String
- `description`: String
- `price`: Decimal
- `stock`: Integer
- `imageUrl`: String (nullable)
- `isActive`: Boolean (default: true)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Cart
- `id`: Integer (PK)
- `sessionId`: String (Unique)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### CartItem
- `id`: Integer (PK)
- `cartId`: Integer (FK)
- `productId`: Integer (FK)
- `qty`: Integer

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5433/ecomm` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret-key` |

## File Structure

```
src/
├── auth/              # Authentication module
│   ├── dto/           # Data Transfer Objects
│   ├── guards/        # JWT and Admin guards
│   ├── strategies/    # JWT strategy
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── admin/             # Admin module
│   ├── admin.controller.ts
│   └── admin.module.ts
├── products/          # Products module
│   ├── dto/
│   ├── products.controller.ts
│   ├── products.service.ts
│   └── products.module.ts
├── cart/              # Cart module
│   ├── cart.controller.ts
│   ├── cart.service.ts
│   └── cart.module.ts
├── prisma/            # Prisma service
│   └── prisma.service.ts
├── app.module.ts
└── main.ts
```

## Password Hashing

Passwords are hashed using bcrypt with salt rounds = 10. Never store or transmit plain passwords.

## CORS Configuration

CORS is enabled with:
- Origin: any (configurable)
- Credentials: true
- Methods: GET, POST, PUT, DELETE
- Credentials cookies enabled

## Notes

- Images uploaded to `uploads/products/` and served statically at `/uploads/products/*`
- JWT tokens expire after 7 days
- Admin users created via seeding or signup with role override
- All product operations support pagination (future enhancement)


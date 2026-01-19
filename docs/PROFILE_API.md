# Profile API

Authentication: All endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

- GET /api/users/me
  - Description: Retrieve the authenticated user's profile (excludes sensitive fields like password).
  - Response: 200
    - { id, name, email, role, createdAt, updatedAt }

- PATCH /api/users/me
  - Description: Update the authenticated user's profile. Allowed fields: `name`, `email`.
  - Request body (application/json):
    - { name?: string, email?: string }
  - Response: 200
    - Updated user object (same shape as GET)

- POST /api/users/me/email-change
  - Description: Initiate an email change. Sends a verification email to the new address with a confirmation link or token.
  - Request body: { email: string }
  - Response: 200
    - { ok: true }

- POST /api/users/me/email/confirm
  - Description: Confirm an email change. Accepts a signed token previously emailed to the new address. Requires authentication (or can be implemented as a public endpoint if token-only confirmation desired).
  - Request body: { token: string }
  - Response: 200
    - Updated user object (same shape as GET)

- POST /api/users/me/change-password
  - Description: Change the authenticated user's password. Requires the current password for verification.
  - Request body: { currentPassword: string, newPassword: string }
  - Response: 200
    - { ok: true }

Password reset (forgot password):

- POST /api/users/password-reset
  - Description: Request a password reset email. Does not reveal whether the email is registered.
  - Request body: { email: string }
  - Response: 200
    - { ok: true }

- POST /api/users/password-reset/confirm
  - Description: Confirm a password reset using a signed token (sent by email) and set a new password.
  - Request body: { token: string, newPassword: string }
  - Response: 200
    - { ok: true }

Notes:
- Email changes are allowed but should be validated by client workflow (verification) in production.
- Password changes are not handled via this endpoint; use dedicated change-password flow.
 - Email change flow:
   - `POST /api/users/me/email-change` will email a signed, time-limited token to the new address.
   - `POST /api/users/me/email/confirm` will verify the token and update the user's email.
   - Tokens are JWTs signed using `EMAIL_CHANGE_TOKEN_SECRET` (fallback to `JWT_SECRET`).
   - In production, email sending is handled via SendGrid; development mode logs the verification URL.

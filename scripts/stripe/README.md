Confirm & Capture Stripe PaymentIntent

Purpose
- Small helper to confirm and capture a Stripe PaymentIntent (test mode).

Usage
- PowerShell:

```powershell
$env:STRIPE_API_KEY = "sk_test_..."
node scripts/stripe/confirm-payment-intent.js <payment_intent_id>
```

- macOS / Linux:

```bash
STRIPE_API_KEY=sk_test_... node scripts/stripe/confirm-payment-intent.js <payment_intent_id>
```

Behavior
- Confirms the PaymentIntent using the test payment method `pm_card_visa`.
- If Stripe requires a `return_url` for redirect-capable payment methods, the script retries with `https://example.com/stripe-return`.
- If the PaymentIntent status becomes `requires_capture`, the script immediately calls capture.
- Successful intents will show `status: "succeeded"` in the JSON output.

Notes
- Use a Stripe test secret key (`sk_test_...`). Do not use live keys here.
- Node 18+ has built-in `fetch`. For older Node versions, install `node-fetch`:

```bash
npm install node-fetch
```

- The script logs full JSON responses from Stripe; paste them here if you need help diagnosing errors.

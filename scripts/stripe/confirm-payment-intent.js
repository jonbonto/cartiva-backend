#!/usr/bin/env node
// Confirm and capture a Stripe PaymentIntent using fetch and env STRIPE_API_KEY
// Usage: STRIPE_API_KEY=sk_test_... node scripts/stripe/confirm-payment-intent.js pi_123
require('dotenv').config()
const id = process.argv[2]
const key = process.env.STRIPE_SECRET_KEY

if (!id) {
  console.error('Usage: STRIPE_API_KEY=sk_test_xxx node scripts/stripe/confirm-payment-intent.js <payment_intent_id>')
  process.exit(1)
}
if (!key) {
  console.error('Set STRIPE_API_KEY environment variable to your Stripe Secret Key (test key).')
  process.exit(1)
}

let fetchImpl
try {
  fetchImpl = globalThis.fetch || require('node-fetch')
} catch (e) {
  // will try global fetch later
}
const fetch = fetchImpl || globalThis.fetch

if (!fetch) {
  console.error('No fetch available. For Node <18, install node-fetch (`npm install node-fetch`).')
  process.exit(1)
}

async function postForm(url, params) {
  const body = new URLSearchParams(params)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(key + ':').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
  return res.json()
}

async function main() {
  try {
    console.log(`Confirming PaymentIntent ${id}...`)
    const confirmUrl = `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}/confirm`

    // Use a test payment method that succeeds in Stripe test mode.
    let confirmResp = await postForm(confirmUrl, { payment_method: 'pm_card_visa' })
    console.log('Confirm response status:', confirmResp.status)
    console.log(JSON.stringify(confirmResp, null, 2))

    // If Stripe complains that a `return_url` is required (when the PI accepts redirect
    // capable payment methods), retry including a harmless `return_url` so the confirm
    // succeeds for test cards that don't actually redirect.
    if (confirmResp.error) {
      const msg = confirmResp.error && confirmResp.error.message ? String(confirmResp.error.message) : ''
      if (msg.includes('must provide a `return_url`') || msg.includes('must provide a return_url') || msg.includes('provide a `return_url`')) {
        console.log('Stripe requires a return_url for this PaymentIntent; retrying with one...')
        confirmResp = await postForm(confirmUrl, { payment_method: 'pm_card_visa', return_url: 'https://example.com/stripe-return' })
        console.log('Confirm retry response status:', confirmResp.status)
        console.log(JSON.stringify(confirmResp, null, 2))
      }
    }

    if (confirmResp.error) {
      console.error('Error confirming PaymentIntent:', confirmResp.error)
      process.exit(2)
    }

    if (confirmResp.status === 'requires_capture') {
      console.log('PaymentIntent requires capture — capturing now...')
      const captureUrl = `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}/capture`
      const captureResp = await postForm(captureUrl, {})
      console.log('Capture response status:', captureResp.status)
      console.log(JSON.stringify(captureResp, null, 2))
      if (captureResp.error) {
        console.error('Error capturing PaymentIntent:', captureResp.error)
        process.exit(3)
      }
    }

    console.log('Done. Check status above — successful intents will have status `succeeded`.')
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(99)
  }
}

main()

import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const ADDRESSES_PER_USER = parseInt(__ENV.ADDRESSES_PER_USER || '1000', 10)

// Recommended run: `k6 run --vus <users> --iterations 1 scripts/perf/k6_users_addresses.js`
export let options = {
  vus: parseInt(__ENV.VUS || '1', 10),
  iterations: parseInt(__ENV.ITERATIONS || '1', 10),
}

export default function () {
  const vu = __VU
  const email = `perf.user.${vu}.${Date.now()}@example.com`

  const signupRes = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify({ name: `Perf ${vu}`, email, password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  const token = signupRes.json('token') || ''

  for (let i = 0; i < ADDRESSES_PER_USER; i++) {
    const dto = {
      fullName: `Perf User ${vu}`,
      streetLine1: `Addr ${i}`,
      city: 'Testville',
      stateProvince: 'TS',
      postalCode: '00000',
      country: 'US',
    }

    const res = http.post(`${BASE_URL}/api/users/me/addresses`, JSON.stringify(dto), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    check(res, { 'status 201 or 200': (r) => r.status === 201 || r.status === 200 })

    if (i % 100 === 0) sleep(0.01)
  }

  sleep(1)
}

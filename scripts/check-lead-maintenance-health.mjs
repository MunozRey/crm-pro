const FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY
const MAINTENANCE_SECRET = process.env.LEAD_MAINTENANCE_SECRET
const ORG_ID = process.env.LEAD_MAINTENANCE_ORG_ID

if (!FUNCTIONS_URL || !ANON_KEY || !MAINTENANCE_SECRET) {
  console.error(
    'Missing env vars. Required: SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY, LEAD_MAINTENANCE_SECRET',
  )
  process.exit(1)
}

const qs = ORG_ID ? `?mode=health&organizationId=${encodeURIComponent(ORG_ID)}` : '?mode=health'
const endpoint = `${FUNCTIONS_URL.replace(/\/+$/, '')}/lead-score-maintenance${qs}`

const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    'x-maintenance-secret': MAINTENANCE_SECRET,
  },
  body: JSON.stringify({ organizationId: ORG_ID }),
})

const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Lead maintenance health check failed:', data)
  process.exit(1)
}

console.log('Lead maintenance health:', data)

const FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY
const MAINTENANCE_SECRET = process.env.LEAD_MAINTENANCE_SECRET
const ORG_ID = process.env.LEAD_MAINTENANCE_ORG_ID
const RUN_ALL = process.argv.includes('--all') || process.env.LEAD_MAINTENANCE_RUN_ALL === 'true'

if (!FUNCTIONS_URL || !ANON_KEY || !MAINTENANCE_SECRET) {
  console.error(
    'Missing env vars. Required: SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY, LEAD_MAINTENANCE_SECRET',
  )
  process.exit(1)
}

if (!RUN_ALL && !ORG_ID) {
  console.error('Set LEAD_MAINTENANCE_ORG_ID or LEAD_MAINTENANCE_RUN_ALL=true')
  process.exit(1)
}

const payload = RUN_ALL ? { runAllOrgs: true } : { organizationId: ORG_ID }
const endpoint = `${FUNCTIONS_URL.replace(/\/+$/, '')}/lead-score-maintenance`

const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    'x-maintenance-secret': MAINTENANCE_SECRET,
  },
  body: JSON.stringify(payload),
})

const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Lead maintenance failed:', data)
  process.exit(1)
}

console.log('Lead maintenance executed:', data)

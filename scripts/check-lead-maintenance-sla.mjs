const FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY
const MAINTENANCE_SECRET = process.env.LEAD_MAINTENANCE_SECRET
const THRESHOLD_HOURS = process.env.LEAD_MAINTENANCE_SLA_HOURS ?? '8'
const COOLDOWN_HOURS = process.env.LEAD_MAINTENANCE_SLA_COOLDOWN_HOURS ?? '6'
const NOTIFY_MANAGERS = process.env.LEAD_MAINTENANCE_SLA_NOTIFY_MANAGERS ?? 'true'

if (!FUNCTIONS_URL || !ANON_KEY || !MAINTENANCE_SECRET) {
  console.error(
    'Missing env vars. Required: SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY, LEAD_MAINTENANCE_SECRET',
  )
  process.exit(1)
}

const endpoint = `${FUNCTIONS_URL.replace(/\/+$/, '')}/lead-score-maintenance?mode=sla`
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    'x-maintenance-secret': MAINTENANCE_SECRET,
  },
  body: JSON.stringify({
    thresholdHours: Number(THRESHOLD_HOURS),
    cooldownHours: Number(COOLDOWN_HOURS),
    notifyManagers: NOTIFY_MANAGERS !== 'false',
  }),
})

const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error('Lead maintenance SLA check failed:', data)
  process.exit(1)
}

console.log('Lead maintenance SLA check:', data)

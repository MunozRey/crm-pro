# External Integrations

**Analysis Date:** 2026-04-10

## APIs & External Services

**AI — Anthropic Claude:**
- Status: browser-side Anthropic SDK usage is disabled by policy
- Rationale: `dangerouslyAllowBrowser` was removed as a security hardening measure
- Current pattern: AI calls should go through server-side proxy/edge paths only

**AI — OpenRouter:**
- Used for: same AI features as Anthropic, as a selectable alternative provider
- SDK/Client: Raw `fetch` to `https://openrouter.ai/api/v1/chat/completions` (`src/services/aiService.ts`)
- Auth: OpenRouter API key entered by user in Settings, persisted to `localStorage` via `useAIStore`
- HTTP headers: `Authorization: Bearer <key>`, `HTTP-Referer: https://crm-pro.app`, `X-Title: CRM Pro`
- Supports both non-streaming (JSON) and streaming (SSE) modes
- Available models (defined in `src/constants/aiModels.ts`):
  - `glm-4.6` (ZhipuAI), `gpt-oss-120b`, `qwen3-235b-instruct-2507` (Alibaba)
  - `deepseek-v3.2-exp`, `deepseek-r1-0528` (DeepSeek)
  - `apriel-1.5-15b-thinker` (ServiceNow), `kimi-k2-instruct-0905` (Moonshot)
  - `llama-3.3-nemotron-super-49b-v1.5` (NVIDIA), `mistral-small-3.2-24b-instruct-2506`

**Email — Gmail:**
- Used for: reading inbox threads and sending emails from within the CRM
- SDK/Client: Raw `fetch` to `https://gmail.googleapis.com/gmail/v1/users/me` (`src/services/gmailService.ts`)
- Auth: OAuth 2.0 Authorization Code + PKCE
  - Browser initiates PKCE flow and callback (`/auth/gmail/callback`)
  - Edge Function `gmail-oauth-exchange` performs code exchange securely
  - Refresh token is stored server-side in `gmail_tokens`
  - Short-lived access token is stored in-memory via `GmailTokenContext` (not persisted)
  - Edge Function `gmail-refresh-token` is used for token renewal
- Scopes requested:
  - `https://www.googleapis.com/auth/gmail.send`
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.compose`
- Operations: `GET /threads`, `GET /threads/{id}`, `POST /messages/send`, `GET /profile`
- Additional integration: `gmail_thread_links` table stores pinned thread-to-CRM links (contact/company/deal)

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (env vars, optional)
  - Client: `@supabase/supabase-js` 2.100, initialized in `src/lib/supabase.ts`
  - The client is `null` when env vars are absent; all stores check `isSupabaseConfigured` before using it
  - Schema defined in `supabase/schema.sql`
  - Tables: core CRM tables + org/auth support + secondary modules (products, templates, sequences, automations, goals, audit, custom fields, `gmail_tokens`, `gmail_thread_links`)
  - Row Level Security (RLS) enabled on all tables
    - All authenticated users can read/write all CRM tables (team-wide access)
    - Notifications are restricted to owner (`auth.uid() = user_id`)
  - `updated_at` auto-managed via PostgreSQL trigger `handle_updated_at()`
  - UUID primary keys via `uuid-ossp` extension
  - TypeScript types generated/maintained manually in `src/lib/database.types.ts`

**Fallback / Offline Storage:**
- When Supabase is not configured, all CRM data is persisted to `localStorage` via Zustand `persist` middleware
- This is the default mode in development without a Supabase project configured
- `localStorage` keys (defined in `src/utils/constants.ts`): `crm_auth`, `crm_ai`, `crm_emails`, and per-store keys via `LS_KEYS`

**File Storage:**
- Not detected — no S3, Supabase Storage, or other file storage integration present

**Caching:**
- None — no Redis, Memcached, or CDN cache layer

## Authentication & Identity

**Primary Auth Provider:**
- Supabase Auth (when `isSupabaseConfigured` is true)
  - Initialized via `initSupabaseAuth()` in `src/store/authStore.ts`
  - Listens to `supabase.auth.onAuthStateChange` and maps Supabase user to `AuthUser` type
  - Role and organization context resolved from JWT/app metadata + org membership

**Fallback Auth Provider (demo mode only):**
- Local/demo auth state is used only when Supabase env vars are absent

**Gmail OAuth:**
- Handled separately via Google Identity Services (see Gmail section above)
- Not connected to the primary auth system

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry, Datadog, or similar integration

**Logs:**
- `src/store/auditStore.ts` provides an in-app audit log: `logAction(action, entity, entityId, title, detail)`
- Audit entries are persisted to `localStorage` via Zustand persist
- Audit log is viewable at the `/audit` route (`src/pages/AuditLog.tsx`)
- No external log shipping

## CI/CD & Deployment

**Hosting:**
- Not detected in codebase — no `vercel.json`, `netlify.toml`, or Dockerfile present
- Application builds to a static bundle (`npm run build`) suitable for any static host

**CI Pipeline:**
- GitHub Actions CI is present and aligned with Vitest + TypeScript checks

## Environment Configuration

**Required env vars (Supabase — optional):**
- `VITE_SUPABASE_URL` — Supabase project REST/Auth URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon (public) key

**Runtime-configured secrets (entered by user in Settings UI, stored locally as applicable):**
- OpenRouter API key — stored in `useAIStore.openRouterKey`
- Google OAuth Client ID — used to initiate OAuth; token exchange and refresh handled by Supabase Edge Functions

**Secrets location:**
- `.env` file (gitignored) for Supabase URL/key
- All AI and Google credentials: user-entered at runtime, never in `.env`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected (Gmail sending is direct API call, not webhook-based)

---

*Integration audit: 2026-04-10*

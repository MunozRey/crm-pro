---
phase: "04"
plan: "04.1-04.4"
subsystem: security
tags: [security, xss, localStorage, api-keys, anthropic, openrouter]
dependency_graph:
  requires: [03-organization-onboarding]
  provides: [secure-ai-key-storage, xss-free-chat, no-browser-sdk]
  affects: [aiStore, aiService, AIAgent, Settings, MeetingPrepModal, AICopilotWidget, EmailComposer, CommandPalette, ContactDetail, Deals]
tech_stack:
  added: [react-markdown@^9, rehype-sanitize@^6]
  patterns: [OpenRouter-only AI calls, partialize-exclude-sensitive-keys]
key_files:
  created: []
  modified:
    - src/store/aiStore.ts
    - src/pages/Settings.tsx
    - src/pages/AIAgent.tsx
    - src/services/aiService.ts
    - src/components/ai/MeetingPrepModal.tsx
    - src/components/ai/AICopilotWidget.tsx
    - src/components/email/EmailComposer.tsx
    - src/components/layout/CommandPalette.tsx
    - src/pages/ContactDetail.tsx
    - src/pages/Deals.tsx
    - src/lib/supabase.ts (verified, no change needed)
decisions:
  - "Anthropic SDK removed entirely — OpenRouter fetch path is the only AI transport until Phase 7 Edge Function proxy"
  - "openRouterKey replaces apiKey everywhere in UI guards — single key, no confusion"
  - "react-markdown + rehype-sanitize replaces renderMarkdown fn — eliminates XSS vector"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-05"
  tasks_completed: 4
  files_modified: 10
---

# Phase 4 Plans 04.1-04.4: Security Fixes Summary

**One-liner:** Removed Anthropic API key from localStorage, replaced dangerouslySetInnerHTML with react-markdown+rehype-sanitize in AIAgent, and eliminated the dangerouslyAllowBrowser Anthropic SDK path — all AI calls now go through OpenRouter fetch only.

## Plans Executed

### 04.1 — Remove Anthropic API key from localStorage (SEC-02)

- Removed `apiKey: string` field and `setApiKey` action from `AIStore` interface and implementation
- Removed `apiKey: s.apiKey` from `partialize` in the persist middleware — key can no longer leak to `localStorage`
- Updated `Settings.tsx`: removed `apiKey`/`setApiKey` from `useAIStore()` destructure, removed `apiKeyInput` state, removed `handleSaveApiKey`, removed the entire "Anthropic API Key" form block (label, password input, Eye/EyeOff toggle, Save button, configured indicator, hint text)
- The OpenRouter key field was preserved and moved to be the primary (now only) AI key field; the Eye/EyeOff toggle was kept on the OpenRouter field

### 04.2 — Fix XSS in AIAgent (SEC-03)

- Installed `react-markdown@^9` and `rehype-sanitize@^6` via `npm install`
- Removed the `renderMarkdown` function (regex-based HTML string builder — direct XSS vector)
- Removed both `import` and `dangerouslySetInnerHTML` usages (2 instances found and removed)
- Assistant message rendering: replaced with `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>` inside the existing bubble div
- Streaming text rendering: replaced self-closing div with `dangerouslySetInnerHTML` with a regular div containing `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{streamingText}</ReactMarkdown>`
- Codebase-wide audit: `grep -r "dangerouslySetInnerHTML" src/` returned 0 matches after changes

### 04.3 — Remove dangerouslyAllowBrowser (SEC-04)

- Removed `import Anthropic from '@anthropic-ai/sdk'`
- Removed `makeClient` function
- Updated `getModelOpts`: removed `anthropicKey` parameter and return field — now returns `{ model, openRouterKey }` only
- Updated `callJSON`: removed Anthropic SDK else-branch, replaced with `throw new Error('[aiService] Direct Anthropic calls disabled. Edge Function proxy required (Phase 7).')`
- Updated `callStream`: same — OpenRouter path intact, Anthropic path replaced with throw
- Removed `apiKey: string` parameter from all 6 exported functions: `enrichContact`, `enrichDeal`, `salesAssistantStream`, `generateEmailDraft`, `generateDailyBrief`, `generateMeetingPrep`, `parseNaturalLanguageCommand`
- Updated all `getModelOpts(apiKey)` call sites to `getModelOpts()` (7 call sites in aiService.ts)
- Updated all 10 callers across components and pages to remove the `apiKey` argument and use `openRouterKey` from store for guards

### 04.4 — Verify SEC-06 (dev warning)

SEC-06 is **confirmed implemented** in `src/lib/supabase.ts`:

```typescript
if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[CRM] Supabase env vars missing or invalid. Running in mock/demo mode.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable real auth.'
  )
}
```

The test `tests/lib/supabase.test.ts > supabase lib > SEC-06: console.warn fires in dev when VITE_SUPABASE_URL is absent` passes green. No code change required.

## Type Errors Fixed

Running `npx tsc --noEmit` after changes surfaced 5 errors — all **pre-existing** (not caused by Phase 4):

- `src/lib/supabase.ts`: `Property 'env' does not exist on type 'ImportMeta'` (2 lines + 1 in DEV check) — pre-existing tsconfig issue
- `src/pages/Activities.tsx`: `Cannot find name 'Locale'` — pre-existing import issue
- `src/pages/TeamManagement.tsx`: `Property 'env' does not exist on type 'ImportMeta'` — pre-existing

None of the Phase 4 modified files introduced new type errors.

## Test Results

```
Test Files  7 passed (7)
     Tests  19 passed (19)
  Duration  15.26s
```

All 19 tests green. SEC-06 test confirmed working.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Updated UI key guards from apiKey to openRouterKey**
- **Found during:** Task execution of 04.3 — after removing apiKey from aiStore, all component guards using `!apiKey` would always be undefined/falsy
- **Fix:** Replaced all `apiKey` variable bindings and guard checks with `openRouterKey` across 8 files (AIAgent, MeetingPrepModal, AICopilotWidget, EmailComposer, CommandPalette, ContactDetail, Deals, Settings)
- **Files modified:** All 8 listed above
- **Commit:** cec16350

**2. [Rule 1 - Bug] Simplified redundant model selector in parseNaturalLanguageCommand**
- **Found during:** 04.3 — `parseNaturalLanguageCommand` had `model = isOpenRouterModel(m) ? m : 'claude-haiku-4-5-20251001'` — the Anthropic fallback was dead code after removing the SDK path
- **Fix:** Simplified to use the selected model directly (the throw in callJSON handles non-OR models)
- **Commit:** cec16350

## Known Stubs

None. All AI calls now correctly route through OpenRouter or throw with a clear message. No placeholder data flows to UI rendering.

## Self-Check

- [x] `src/store/aiStore.ts` — `apiKey` field removed from interface, state, and partialize
- [x] `src/services/aiService.ts` — `import Anthropic` removed, `dangerouslyAllowBrowser` gone, all functions no longer accept `apiKey`
- [x] `src/pages/AIAgent.tsx` — no `renderMarkdown`, no `dangerouslySetInnerHTML`
- [x] `src/lib/supabase.ts` — `console.warn` present for SEC-06
- [x] Commit `cec16350` exists

## Self-Check: PASSED

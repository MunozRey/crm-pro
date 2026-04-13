# User profile, display names, and CRM consistency

Team register: what was implemented, how it works technically, what is covered for day-to-day use, and what remains for a “complete” model.

---

## 1. Problem we addressed

| Symptom | Root cause |
|--------|------------|
| After changing the name in the profile (e.g. **David** with correct casing or **JoseLuis**), **logging out and back in** showed something like **david** in lowercase. | With **Supabase**, the name shown at login comes from `auth.users` → **`user_metadata.full_name`**. If it is missing, the client falls back to the **email local-part** (often lowercase). |
| Saving from the profile screen **did not persist** across sessions. | `updateUser` in the store only updated **Zustand** (in-memory / locally persisted state), **without** writing to Supabase Auth. |

---

## 2. What is implemented (done)

### 2.1 Persistence in Supabase Auth

- **File:** `src/store/authStore.ts` → `updateUser` action.
- **Behavior:** When Supabase is active (`isSupabaseConfigured`), the edited user is the **current** user (`isSelf`), and the patch includes profile fields (`name`, `jobTitle`, `phone`, `avatar`), the app calls:

  `supabase.auth.updateUser({ data: { ... } })`

- **Mapping to Supabase metadata (project convention):**

  | App field (`AuthUser`) | `user_metadata` key |
  |------------------------|---------------------|
  | `name` | `full_name` |
  | `jobTitle` | `job_title` |
  | `phone` | `phone` |
  | `avatar` | `avatar_url` |

- After a successful response, the store updates `users` and `currentUser` from Supabase (preferring server metadata).
- On network or Auth errors, **`toast.error`** shows the returned message.
- **`fetchOrgUsers(organizationId)`** runs (non-blocking) to align the in-memory team list.

### 2.2 Reading the name at login

- **File:** `src/store/authStore.ts` → `initSupabaseAuth` / `onAuthStateChange` → `setCurrentUser`.
- **Name priority:** `user_metadata.full_name` → email local-part → `"User"`.

With `full_name` saved correctly, the header, account menu, and anything that reads `currentUser.name` show the **persisted** name.

### 2.3 Demo mode (no Supabase)

- If Supabase is **not** configured, the profile still updates local state only (`applyLocal()`), consistent with mock/seed mode.

---

## 3. What works for the team today

| Area | Status | Notes |
|------|--------|--------|
| Change name / job title / phone / avatar in **My profile** (current user) with Supabase | **Yes** | Persists in Auth; new session respects `full_name` and other mapped keys. |
| See name in header / account switcher after login | **Yes** | Depends on `user_metadata` as above. |
| Team list (`fetchOrgUsers`) after saving profile | **Improved** | Explicit refresh after save; cached names may still merge with existing data. |
| Edit **another** user (admin) via `updateUser` in production | **Partial / out of scope here** | Only the **signed-in** user can call `supabase.auth.updateUser` from the client. Changing another member’s data requires an **Edge Function**, **service role**, or the Supabase Dashboard (outside this change). |

---

## 4. Not done or technical debt (pending)

These items describe the gap until the product is fully consistent **everywhere** a name or “assigned to” appears.

| Topic | Description | Suggested priority |
|-------|-------------|-------------------|
| **Historical values in CRM data** | Contacts, deals, activities, notifications, saved views, etc. may store **plain-text** old names (e.g. `assigned_to` as a label, or seeds like `"David Muñoz"`). Changing the profile **does not** rewrite those rows automatically. | Medium: propagation or one-off migration on rename. |
| **Identifier vs label** | Where the **DB schema already uses UUID** (`assigned_to` → `auth.users`), the UI should always resolve **display name from current users**, not rely on stale strings. Where local/demo data still uses strings, labels can drift. | High–medium term: single source of truth (user id + resolution in UI). |
| **Saved filters keyed by name** | If a filter stored the exact previous name string, it may stop matching after a rename. | Low/medium depending on usage. |
| **Real avatar (file upload)** | If the UI only stores a URL in metadata but there is no **Storage upload** flow, the avatar may stay empty or manual. | Per profile roadmap. |
| **Error message i18n** | The `toast` may show a technical English message from Supabase. | Product polish. |

---

## 5. Manual validation (checklist)

1. With Supabase enabled, open **Profile**, set the name to something clearly different from the email local-part (e.g. `David` with capital D).
2. Save and confirm the UI shows the new name without a full reload (local state).
3. **Log out** and **log back in**.
4. Check header / menu: the **saved** name should appear, **not** the lowercase email local-part.
5. (Optional) In Supabase Dashboard → Authentication → user → **User Metadata**: confirm `full_name` (and other keys if applicable).

---

## 6. Code references

| What | Where |
|------|--------|
| Profile save + `updateUser` + Supabase | `src/store/authStore.ts` |
| Profile screen | `src/pages/UserProfile.tsx` |
| Session bootstrap and `full_name` read | `src/store/authStore.ts` (`initSupabaseAuth`) |
| Initial signup with `full_name` | `src/pages/Register.tsx` (`user_metadata` on signUp) |

---

## 7. Document history

| Date | Change |
|------|--------|
| 2026-04-13 | Initial register: profile persistence via `supabase.auth.updateUser`; scope and pending items documented. |
| 2026-04-13 | Full document translated to English. |

---

*Technical content last aligned with `authStore` (`updateUser` action). If the profile flow changes, update sections 2 and 6.*

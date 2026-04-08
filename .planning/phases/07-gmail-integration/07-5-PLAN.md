---
phase: 07-gmail-integration
plan: 5
type: execute
wave: 4
depends_on:
  - "07-4"
files_modified:
  - src/pages/ContactDetail.tsx
  - src/pages/Deals.tsx
autonomous: true
requirements:
  - GMAIL-05
  - GMAIL-06

must_haves:
  truths:
    - "A 'Send Email' button exists on ContactDetail that opens EmailComposer in a SlideOver with the contact's email pre-filled"
    - "A 'Send Email' button exists on DealDetail (or Deals page) that opens EmailComposer in a SlideOver"
    - "After a successful send, an activity of type 'email' is logged in activitiesStore with contactId/dealId and the email subject"
    - "Sending uses the in-memory access token from GmailTokenContext — no token is read from localStorage"
  artifacts:
    - path: "src/pages/ContactDetail.tsx"
      provides: "isEmailOpen state + SlideOver with EmailComposer wired to contact email + activity logging on send"
    - path: "src/pages/Deals.tsx"
      provides: "Email SlideOver from deal context with EmailComposer + activity logging on send"
  key_links:
    - from: "src/pages/ContactDetail.tsx"
      to: "src/components/email/EmailComposer.tsx"
      via: "SlideOver wrapper with isEmailOpen state"
      pattern: "isEmailOpen.*EmailComposer\|EmailComposer.*isEmailOpen"
    - from: "src/pages/ContactDetail.tsx"
      to: "src/store/activitiesStore.ts"
      via: "useActivitiesStore.getState().addActivity({ type: 'email', ... })"
      pattern: "addActivity.*email\|type.*email"
    - from: "src/pages/ContactDetail.tsx"
      to: "src/store/emailStore.ts"
      via: "emailStore.sendEmail({ ...params, accessToken })"
      pattern: "sendEmail.*accessToken"
---

<objective>
Add "Send Email" SlideOver with EmailComposer to ContactDetail and Deals pages, wire the send action to emailStore.sendEmail with the in-memory access token, and log each sent email as an activity in activitiesStore.

Purpose: This is the final user-facing feature of Phase 7. Users can compose and send emails without leaving the contact or deal page, and every sent email is automatically recorded in the CRM activity feed.

Output:
- `src/pages/ContactDetail.tsx` — Send Email button + SlideOver + activity log on send
- `src/pages/Deals.tsx` — Same pattern for deal context
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-gmail-integration/07-CONTEXT.md
@.planning/phases/07-gmail-integration/07-1-SUMMARY.md
@.planning/phases/07-gmail-integration/07-4-SUMMARY.md

<interfaces>
<!-- EmailComposer props (src/components/email/EmailComposer.tsx — read before implementing): -->
<!-- Read the file to get exact prop names — they are the source of truth -->

<!-- emailStore.sendEmail — updated signature from Plan 07-1: -->
```typescript
sendEmail: (params: {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  contactId?: string
  dealId?: string
  companyId?: string
  accessToken?: string  // pass in-memory token; if undefined, email saves locally only
}) => Promise<CRMEmail>
```

<!-- activitiesStore.addActivity pattern (established in Phase 5): -->
```typescript
useActivitiesStore.getState().addActivity({
  type: 'email',
  subject: emailSubject,
  contactId: contact.id,
  dealId: deal?.id,          // optional
  date: new Date().toISOString(),
  notes: `Email sent: ${emailSubject}`,
})
```

<!-- SlideOver pattern (used in ContactDetail already for ActivityForm, ContactForm): -->
```tsx
import { SlideOver } from '../components/ui/Modal'
// State:
const [isEmailOpen, setIsEmailOpen] = useState(false)
// Trigger:
<Button onClick={() => setIsEmailOpen(true)}>Send Email</Button>
// SlideOver:
<SlideOver isOpen={isEmailOpen} onClose={() => setIsEmailOpen(false)} title="Compose Email">
  <EmailComposer ... />
</SlideOver>
```

<!-- GmailTokenContext: -->
```typescript
const { accessToken } = useGmailToken()
```

<!-- Contact shape: contact.email, contact.firstName, contact.lastName, contact.id -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Send Email SlideOver to ContactDetail</name>
  <files>src/pages/ContactDetail.tsx</files>
  <read_first>
    - src/pages/ContactDetail.tsx (read the full file — understand existing state variables, imports, tabs, and where the email tab renders CRMEmail history so we integrate without overlap)
    - src/components/email/EmailComposer.tsx (read the full file — get exact prop names and required vs optional props)
    - src/contexts/GmailTokenContext.tsx (useGmailToken hook)
    - src/store/activitiesStore.ts (addActivity signature — confirm field names)
  </read_first>
  <action>
Add a Send Email flow to `src/pages/ContactDetail.tsx`. Make surgical additions — do not rewrite the file.

**1. Add imports** (at the top, after existing imports):
```typescript
import { useGmailToken } from '../contexts/GmailTokenContext'
import { useActivitiesStore } from '../store/activitiesStore'
// EmailComposer and SlideOver already imported — verify and add if missing
```

**2. Add state** inside the `ContactDetail` component, alongside existing state variables:
```typescript
const [isEmailOpen, setIsEmailOpen] = useState(false)
const { accessToken } = useGmailToken()
const sendEmailToStore = useEmailStore((s) => s.sendEmail)
```

**3. Add `handleSendEmail` handler:**
```typescript
const handleSendEmail = async (params: {
  to: string[]
  cc?: string[]
  subject: string
  body: string
}) => {
  if (!contact) return
  try {
    await sendEmailToStore({
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      body: params.body,
      contactId: contact.id,
      accessToken: accessToken ?? undefined,
    })

    // Log as activity (per D-16)
    useActivitiesStore.getState().addActivity({
      type: 'email',
      subject: params.subject,
      contactId: contact.id,
      date: new Date().toISOString(),
      notes: `Email sent to ${params.to.join(', ')}: ${params.subject}`,
    })

    toast.success('Email sent')
    setIsEmailOpen(false)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to send email')
  }
}
```

**4. Add "Send Email" button** in the contact header action area (same row as Edit button). Find the existing Edit button (`<Button onClick={() => setIsEditOpen(true)}>`) and add alongside it:
```tsx
<Button
  variant="secondary"
  size="sm"
  onClick={() => setIsEmailOpen(true)}
  disabled={!contact?.email}
>
  <Mail size={14} />
  Send Email
</Button>
```

**5. Add SlideOver** at the bottom of the JSX return, alongside other SlideOvers (ActivityForm SlideOver, ContactForm SlideOver):
```tsx
<SlideOver
  isOpen={isEmailOpen}
  onClose={() => setIsEmailOpen(false)}
  title="Compose Email"
>
  <EmailComposer
    initialTo={contact?.email ? [contact.email] : []}
    onSend={handleSendEmail}
    onClose={() => setIsEmailOpen(false)}
  />
</SlideOver>
```

**Note:** Read `EmailComposer.tsx` first to confirm the exact prop names (`initialTo`, `onSend`, `onClose` — verify these match). If the props differ, use the actual prop names from the file.
  </action>
  <verify>
    <automated>grep -n "isEmailOpen\|handleSendEmail\|Send Email\|useGmailToken\|addActivity.*email\|type.*email" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/pages/ContactDetail.tsx | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "isEmailOpen" src/pages/ContactDetail.tsx` returns at least 3 matches (state declaration, button onClick, SlideOver isOpen)
    - `grep "handleSendEmail" src/pages/ContactDetail.tsx` returns at least 2 matches (definition + usage)
    - `grep "useGmailToken" src/pages/ContactDetail.tsx` returns a match
    - `grep "accessToken" src/pages/ContactDetail.tsx` returns a match (token passed to sendEmail)
    - `grep "type.*email\|email.*type" src/pages/ContactDetail.tsx` returns a match (activity type: 'email')
    - `grep "addActivity" src/pages/ContactDetail.tsx` returns a match
    - `grep "EmailComposer" src/pages/ContactDetail.tsx` returns a match (already existed or newly added)
    - `npx tsc --noEmit 2>&1 | grep "ContactDetail"` returns no errors
  </acceptance_criteria>
  <done>ContactDetail has a Send Email button that opens EmailComposer in a SlideOver. On send, emailStore.sendEmail is called with the in-memory access token, and an activity of type 'email' is logged with the contact ID and subject.</done>
</task>

<task type="auto">
  <name>Task 2: Add Send Email SlideOver to Deals page (deal detail context)</name>
  <files>src/pages/Deals.tsx</files>
  <read_first>
    - src/pages/Deals.tsx (read the full file — understand the deal detail panel/SlideOver structure; find where deal actions are rendered; check if there's already an email action)
    - src/components/email/EmailComposer.tsx (confirm prop names)
    - src/contexts/GmailTokenContext.tsx (useGmailToken)
    - src/store/activitiesStore.ts (addActivity)
  </read_first>
  <action>
Add Send Email capability to the Deals page. The Deals page likely has a deal detail SlideOver or panel. Find the deal action area and add email functionality.

**Pattern to follow** (same as ContactDetail):

**1. Add imports:**
```typescript
import { useGmailToken } from '../contexts/GmailTokenContext'
import { useActivitiesStore } from '../store/activitiesStore'
// EmailComposer, SlideOver — add if not already imported
```

**2. Add state** inside the component:
```typescript
const [isEmailOpen, setIsEmailOpen] = useState(false)
const [emailTargetDeal, setEmailTargetDeal] = useState<typeof deals[0] | null>(null)
const { accessToken } = useGmailToken()
const sendEmailToStore = useEmailStore((s) => s.sendEmail)
```

**3. Add `handleSendEmail` for deals:**
```typescript
const handleSendEmail = async (params: {
  to: string[]
  cc?: string[]
  subject: string
  body: string
}) => {
  if (!emailTargetDeal) return
  try {
    await sendEmailToStore({
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      body: params.body,
      dealId: emailTargetDeal.id,
      contactId: emailTargetDeal.contactId ?? undefined,
      accessToken: accessToken ?? undefined,
    })

    // Log as activity (per D-16)
    useActivitiesStore.getState().addActivity({
      type: 'email',
      subject: params.subject,
      dealId: emailTargetDeal.id,
      contactId: emailTargetDeal.contactId ?? undefined,
      date: new Date().toISOString(),
      notes: `Email sent for deal "${emailTargetDeal.title}": ${params.subject}`,
    })

    toast.success('Email sent')
    setIsEmailOpen(false)
    setEmailTargetDeal(null)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to send email')
  }
}
```

**4. Add "Send Email" button** in the deal action area (deal card or detail panel). Look for where deal action buttons are rendered (Edit, Delete, etc.) and add:
```tsx
<Button
  variant="secondary"
  size="sm"
  onClick={() => { setEmailTargetDeal(deal); setIsEmailOpen(true) }}
>
  <Mail size={14} />
  Send Email
</Button>
```

**5. Add SlideOver** at the bottom of JSX:
```tsx
<SlideOver
  isOpen={isEmailOpen}
  onClose={() => { setIsEmailOpen(false); setEmailTargetDeal(null) }}
  title="Compose Email"
>
  <EmailComposer
    initialTo={[]}
    onSend={handleSendEmail}
    onClose={() => { setIsEmailOpen(false); setEmailTargetDeal(null) }}
  />
</SlideOver>
```

**Important:** Read the file to understand the actual deal data shape (does `deal` have a `contactId`? `title`? `name`?). Use the actual field names from the type definition, not assumptions. If the deal contact has an email, try to pre-fill `initialTo` with `[contact.email]` — but only if contacts are accessible (check if `useContactsStore` is already imported or can be added).
  </action>
  <verify>
    <automated>grep -n "isEmailOpen\|handleSendEmail\|Send Email\|useGmailToken\|addActivity" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/pages/Deals.tsx | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep "isEmailOpen" src/pages/Deals.tsx` returns at least 2 matches
    - `grep "handleSendEmail" src/pages/Deals.tsx` returns at least 2 matches
    - `grep "useGmailToken" src/pages/Deals.tsx` returns a match
    - `grep "type.*email\|email.*type" src/pages/Deals.tsx` returns a match (activity type: 'email')
    - `grep "addActivity" src/pages/Deals.tsx` returns a match
    - `grep "accessToken" src/pages/Deals.tsx` returns a match (token passed to sendEmail)
    - `npx tsc --noEmit 2>&1 | grep "Deals.tsx"` returns no errors
  </acceptance_criteria>
  <done>Deals page has a Send Email button on deals. On send, emailStore.sendEmail is called with the in-memory access token, and an activity of type 'email' is logged with the deal ID and subject.</done>
</task>

</tasks>

<verification>
After all tasks:

1. `grep "isEmailOpen" src/pages/ContactDetail.tsx` — has output
2. `grep "isEmailOpen" src/pages/Deals.tsx` — has output
3. `grep "addActivity" src/pages/ContactDetail.tsx src/pages/Deals.tsx` — has output in both
4. `grep "accessToken" src/pages/ContactDetail.tsx src/pages/Deals.tsx` — has output in both
5. `npx tsc --noEmit` — exits 0

Manual verification:
- Open a contact detail page → click "Send Email" → EmailComposer SlideOver opens with contact email pre-filled
- Compose and send → activity tab shows new email activity
- Open Deals → click "Send Email" on a deal → EmailComposer opens
- After send → activity feed shows email activity linked to deal
</verification>

<success_criteria>
- Send Email button exists on ContactDetail and Deals pages
- EmailComposer opens in a SlideOver with contact/deal context pre-filled
- sendEmail called with in-memory access token (not from localStorage)
- Every successful send creates an activity of type 'email' in activitiesStore with contactId/dealId and subject
- TypeScript compiles without errors in both pages
</success_criteria>

<output>
After completion, create `.planning/phases/07-gmail-integration/07-5-SUMMARY.md`
</output>

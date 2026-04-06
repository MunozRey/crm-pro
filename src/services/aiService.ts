import type { Contact, Company, Deal, Activity, ContactEnrichment, DealEnrichment, AIMessage } from '../types'
import { isOpenRouterModel } from '../constants/aiModels'
import { useAIStore } from '../store/aiStore'

// ─── Model config helper ──────────────────────────────────────────────────────

function getModelOpts(): {
  model: string
  openRouterKey: string
} {
  const { selectedModel, openRouterKey } = useAIStore.getState()
  return {
    model: selectedModel ?? 'claude-opus-4-6',
    openRouterKey: openRouterKey ?? '',
  }
}

// ─── Unified non-streaming call ───────────────────────────────────────────────

async function callJSON(
  prompt: string,
  opts: {
    model: string
    openRouterKey: string
    maxTokens?: number
    systemPrompt?: string
  },
): Promise<string> {
  const isOR = isOpenRouterModel(opts.model)

  if (isOR) {
    if (!opts.openRouterKey) throw new Error('OpenRouter API key required')
    const messages: Array<{ role: string; content: string }> = []
    if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt })
    messages.push({ role: 'user', content: prompt })
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crm-pro.app',
        'X-Title': 'CRM Pro',
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenRouter error: ${err}`)
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0].message.content
  } else {
    throw new Error('[aiService] Direct Anthropic calls disabled. Edge Function proxy required (Phase 7).')
  }
}

// ─── Unified streaming call ───────────────────────────────────────────────────

async function* callStream(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  opts: {
    model: string
    openRouterKey: string
    maxTokens?: number
  },
): AsyncGenerator<string> {
  const isOR = isOpenRouterModel(opts.model)

  if (isOR) {
    if (!opts.openRouterKey) throw new Error('OpenRouter API key required')
    const allMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ]
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crm-pro.app',
        'X-Title': 'CRM Pro',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: allMessages,
        stream: true,
        max_tokens: opts.maxTokens ?? 2048,
      }),
    })
    if (!res.ok || !res.body) throw new Error('OpenRouter stream error')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6)) as {
              choices: Array<{ delta?: { content?: string }; finish_reason?: string }>
            }
            const delta = json.choices[0]?.delta?.content
            if (delta) yield delta
          } catch { /* skip malformed */ }
        }
      }
    }
  } else {
    throw new Error('[aiService] Direct Anthropic streaming disabled. Edge Function proxy required (Phase 7).')
  }
}

// ─── Contact Enrichment ───────────────────────────────────────────────────────

export async function enrichContact(
  contact: Contact,
  company: Company | undefined,
): Promise<ContactEnrichment> {
  const prompt = `You are a B2B sales intelligence expert. Analyze this CRM contact and provide a structured enrichment.

CONTACT DATA:
- Name: ${contact.firstName} ${contact.lastName}
- Job Title: ${contact.jobTitle}
- Email: ${contact.email}
- Company: ${company?.name ?? 'Unknown'} (${company?.industry ?? 'Unknown'} industry, ${company?.size ?? 'Unknown'} employees, ${company?.country ?? 'Unknown'})
- Source: ${contact.source}
- Status: ${contact.status}
- Tags: ${contact.tags.join(', ') || 'none'}
- Notes: ${contact.notes || 'none'}

Respond ONLY with a valid JSON object (no markdown, no explanation) following this exact schema:
{
  "leadScore": <integer 0-100>,
  "personalityType": "<analytical|driver|expressive|amiable>",
  "buyingSignals": ["<signal1>", "<signal2>", "<signal3>"],
  "approachStrategy": "<2-3 sentences on best approach>",
  "suggestedEmailOpener": "<1 personalized email opening sentence>",
  "objectionHandlers": ["<objection: response>", "<objection: response>"],
  "insights": "<3-4 sentence summary of this lead's potential and context>"
}`

  const text = await callJSON(prompt, { ...getModelOpts(), maxTokens: 1024 })
  const parsed = JSON.parse(text) as Omit<ContactEnrichment, 'enrichedAt'>
  return { ...parsed, enrichedAt: new Date().toISOString() }
}

// ─── Deal Enrichment ──────────────────────────────────────────────────────────

export async function enrichDeal(
  deal: Deal,
  contact: Contact | undefined,
  company: Company | undefined,
): Promise<DealEnrichment> {
  const prompt = `You are a B2B sales strategy expert. Analyze this CRM deal and provide a structured enrichment.

DEAL DATA:
- Title: ${deal.title}
- Value: €${deal.value.toLocaleString()}
- Stage: ${deal.stage}
- Probability: ${deal.probability}%
- Priority: ${deal.priority}
- Expected Close: ${deal.expectedCloseDate}
- Source: ${deal.source}
- Notes: ${deal.notes || 'none'}

CONTACT: ${contact ? `${contact.firstName} ${contact.lastName} (${contact.jobTitle})` : 'Unknown'}
COMPANY: ${company ? `${company.name} (${company.industry}, ${company.size})` : 'Unknown'}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "winProbabilityAI": <integer 0-100>,
  "executiveSummary": "<2-3 sentences summarizing deal situation>",
  "keyRisks": ["<risk1>", "<risk2>", "<risk3>"],
  "keyStrengths": ["<strength1>", "<strength2>", "<strength3>"],
  "nextSteps": ["<action1>", "<action2>", "<action3>"],
  "talkingPoints": ["<point1>", "<point2>", "<point3>"],
  "competitiveContext": "<1-2 sentences on competitive landscape for this deal>"
}`

  const text = await callJSON(prompt, { ...getModelOpts(), maxTokens: 1024 })
  const parsed = JSON.parse(text) as Omit<DealEnrichment, 'enrichedAt'>
  return { ...parsed, enrichedAt: new Date().toISOString() }
}

// ─── Sales Assistant Chat (Streaming) ────────────────────────────────────────

export async function* salesAssistantStream(
  messages: AIMessage[],
  context: {
    contacts: Contact[]
    deals: Deal[]
    activities: Activity[]
  },
): AsyncGenerator<string> {
  const openDeals = context.deals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage))
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0)
  const overdueActs = context.activities.filter(
    (a) => a.status === 'pending' && a.dueDate && a.dueDate < new Date().toISOString(),
  )

  const systemPrompt = `You are an expert B2B sales assistant integrated into a CRM platform. You help sales teams with strategy, email drafting, objection handling, and deal analysis.

CURRENT CRM SNAPSHOT:
- Total contacts: ${context.contacts.length}
- Open deals: ${openDeals.length} (total pipeline: €${pipelineValue.toLocaleString()})
- Overdue activities: ${overdueActs.length}
- Top open deals: ${openDeals
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((d) => `${d.title} (€${d.value.toLocaleString()}, ${d.stage})`)
    .join(' | ')}

You can help with:
1. Writing personalized sales emails
2. Preparing for meetings (talking points, objection handling)
3. Analyzing deal health and recommending actions
4. Prioritizing outreach across the pipeline
5. Sales strategy and best practices

Be concise, practical, and actionable. Use markdown formatting when helpful.`

  const anthropicMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  yield* callStream(anthropicMessages, systemPrompt, { ...getModelOpts(), maxTokens: 2048 })
}

// ─── Email Draft Generator ────────────────────────────────────────────────────

export async function generateEmailDraft(
  params: {
    contact: Contact
    company?: Company
    deal?: Deal
    intent: string
  },
): Promise<{ subject: string; body: string }> {
  const prompt = `Write a professional B2B sales email.

RECIPIENT: ${params.contact.firstName} ${params.contact.lastName} (${params.contact.jobTitle} at ${params.company?.name ?? 'their company'})
INTENT: ${params.intent}
${params.deal ? `RELATED DEAL: ${params.deal.title} (€${params.deal.value.toLocaleString()})` : ''}

Respond ONLY with JSON (no markdown):
{
  "subject": "<email subject line>",
  "body": "<full email body, plain text, use \\n for line breaks>"
}`

  const text = await callJSON(prompt, { ...getModelOpts(), maxTokens: 512 })
  return JSON.parse(text) as { subject: string; body: string }
}

// ─── Daily Brief ──────────────────────────────────────────────────────────────

export interface DailyBriefPriority {
  title: string
  action: string
  urgency: 'high' | 'medium' | 'low'
  dealId?: string
  contactId?: string
}

export interface DailyBrief {
  greeting: string
  priorities: DailyBriefPriority[]
  insight: string
  quickWin: string
}

export async function generateDailyBrief(
  data: {
    userName: string
    openDeals: Deal[]
    overdueActivities: Activity[]
    atRiskDealTitles: string[]
    watchDealTitles: string[]
    pipelineValue: number
    wonThisMonth: number
  },
): Promise<DailyBrief> {
  const prompt = `You are a sharp B2B sales coach giving a sales rep their daily briefing. Be direct, specific, and colleague-like — not a motivational bot.

SALES REP: ${data.userName}
PIPELINE VALUE: €${data.pipelineValue.toLocaleString()}
WON THIS MONTH: €${data.wonThisMonth.toLocaleString()}
OPEN DEALS (${data.openDeals.length}):
${data.openDeals.map((d) => `  - ${d.title} | €${d.value.toLocaleString()} | Stage: ${d.stage} | Close: ${d.expectedCloseDate}`).join('\n') || '  none'}
OVERDUE ACTIVITIES (${data.overdueActivities.length}):
${data.overdueActivities.map((a) => `  - ${a.type}: ${a.subject} | Due: ${a.dueDate}`).join('\n') || '  none'}
AT-RISK DEALS (health score < 35): ${data.atRiskDealTitles.join(', ') || 'none'}
WATCH DEALS (health score 35-60): ${data.watchDealTitles.join(', ') || 'none'}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "greeting": "<1 short direct sentence greeting ${data.userName} — acknowledge one specific thing from their pipeline, skip 'Good morning' clichés>",
  "priorities": [
    {
      "title": "<what to do>",
      "action": "<specific next step>",
      "urgency": "<high|medium|low>",
      "dealId": "<deal id if relevant, otherwise omit>",
      "contactId": "<contact id if relevant, otherwise omit>"
    }
  ],
  "insight": "<1-2 sentences of sharp, data-driven sales insight based on their pipeline>",
  "quickWin": "<one concrete thing they can do RIGHT NOW in under 5 minutes that moves the needle>"
}

Include 3-5 priorities ordered by urgency. Focus on what actually matters today.`

  const text = await callJSON(prompt, { ...getModelOpts(), maxTokens: 1024 })
  return JSON.parse(text) as DailyBrief
}

// ─── Meeting Prep ─────────────────────────────────────────────────────────────

export interface MeetingPrep {
  executiveSummary: string
  keyTopics: string[]
  likelyObjections: Array<{ objection: string; response: string }>
  openingLine: string
  desiredOutcome: string
  redFlags: string[]
}

export async function generateMeetingPrep(
  params: {
    contact: Contact
    company?: Company
    deal?: Deal
    recentActivities: Activity[]
  },
): Promise<MeetingPrep> {
  const prompt = `You are an expert B2B sales strategist preparing a sales rep for an upcoming meeting.

CONTACT:
- Name: ${params.contact.firstName} ${params.contact.lastName}
- Title: ${params.contact.jobTitle}
- Email: ${params.contact.email}
- Status: ${params.contact.status}
- Tags: ${params.contact.tags.join(', ') || 'none'}
- Notes: ${params.contact.notes || 'none'}

COMPANY: ${params.company ? `${params.company.name} | ${params.company.industry} | ${params.company.size} employees | ${params.company.country}` : 'Unknown'}

${params.deal ? `DEAL:
- Title: ${params.deal.title}
- Value: €${params.deal.value.toLocaleString()}
- Stage: ${params.deal.stage}
- Probability: ${params.deal.probability}%
- Expected Close: ${params.deal.expectedCloseDate}
- Notes: ${params.deal.notes || 'none'}` : 'NO ASSOCIATED DEAL'}

RECENT ACTIVITIES (last 5):
${params.recentActivities.slice(0, 5).map((a) => `  - [${a.type}] ${a.subject} | ${a.status} | ${a.dueDate}`).join('\n') || '  none'}

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "executiveSummary": "<2-3 sentences on the contact/deal situation and where things stand>",
  "keyTopics": ["<topic1>", "<topic2>", "<topic3>"],
  "likelyObjections": [
    { "objection": "<likely objection>", "response": "<how to handle it>" }
  ],
  "openingLine": "<personalized conversation opener based on their context — not generic>",
  "desiredOutcome": "<specific, measurable outcome to aim for in this meeting>",
  "redFlags": ["<risk or thing to watch out for>"]
}

Include 3-5 keyTopics, 2-3 likelyObjections, and 1-3 redFlags.`

  const text = await callJSON(prompt, { ...getModelOpts(), maxTokens: 1024 })
  return JSON.parse(text) as MeetingPrep
}

// ─── Natural Language Command Parser ─────────────────────────────────────────

export type NLCommandIntent =
  | 'navigate'
  | 'search'
  | 'filter'
  | 'answer'
  | 'create'
  | 'unknown'

export interface NLCommandResult {
  intent: NLCommandIntent
  confidence: number
  navigateTo?: string
  answer?: string
  searchQuery?: string
  searchEntity?: 'contacts' | 'deals' | 'companies' | 'activities'
  filterEntity?: 'contacts' | 'deals' | 'companies'
  filterParams?: Record<string, string>
  createEntity?: 'contact' | 'deal' | 'activity' | 'company'
  prefillData?: Record<string, string>
  explanation: string
}

export async function parseNaturalLanguageCommand(
  text: string,
  context: {
    contacts: Array<{ id: string; name: string }>
    deals: Array<{ id: string; title: string; stage: string; value: number }>
    pipelineValue: number
    openDealsCount: number
    currentPath: string
  },
): Promise<NLCommandResult> {
  const systemPrompt = `You are a CRM command parser. Parse natural language commands from a sales rep and return structured intent JSON.

CRM STRUCTURE:
Valid routes: /dashboard, /contacts, /companies, /deals, /calendar, /activities, /follow-ups, /goals, /notifications, /inbox, /reports, /forecast, /leaderboard, /templates, /sequences, /ai-agent, /team, /settings, /audit

Entities: contacts, deals, companies, activities
Deal stages: lead, qualified, proposal, negotiation, closed_won, closed_lost

Intent types:
- "navigate": user wants to go to a page (e.g. "go to deals", "open settings", "show me the reports")
- "search": user wants to find records (e.g. "find John Smith", "search for Acme deal")
- "filter": user wants to filter the current or specified view (e.g. "show only high priority deals", "filter contacts in Spain")
- "answer": user is asking a question about their CRM data (e.g. "how many open deals do I have?", "what's my pipeline value?")
- "create": user wants to create a new record (e.g. "add a new contact", "create a deal for Acme")
- "unknown": intent cannot be determined

Respond ONLY with valid JSON (no markdown, no explanation).`

  const userPrompt = `CURRENT PATH: ${context.currentPath}
PIPELINE VALUE: €${context.pipelineValue.toLocaleString()}
OPEN DEALS: ${context.openDealsCount}
RECENT CONTACTS (sample): ${context.contacts.slice(0, 5).map((c) => `${c.name} (${c.id})`).join(', ') || 'none'}
RECENT DEALS (sample): ${context.deals.slice(0, 5).map((d) => `${d.title} — ${d.stage} — €${d.value.toLocaleString()} (${d.id})`).join(', ') || 'none'}

COMMAND: "${text}"

Respond ONLY with a valid JSON object:
{
  "intent": "<navigate|search|filter|answer|create|unknown>",
  "confidence": <0.0-1.0>,
  "navigateTo": "<route if intent is navigate, else omit>",
  "answer": "<direct answer if intent is answer, else omit>",
  "searchQuery": "<query string if intent is search, else omit>",
  "searchEntity": "<contacts|deals|companies|activities if intent is search, else omit>",
  "filterEntity": "<contacts|deals|companies if intent is filter, else omit>",
  "filterParams": { "<key>": "<value>" },
  "createEntity": "<contact|deal|activity|company if intent is create, else omit>",
  "prefillData": { "<field>": "<value>" },
  "explanation": "<1 sentence human-readable explanation of what this command will do>"
}

Only include fields relevant to the detected intent. Always include intent, confidence, and explanation.`

  // For the command parser, prefer a fast OpenRouter model when one is active.
  const baseOpts = getModelOpts()
  const model = isOpenRouterModel(baseOpts.model)
    ? baseOpts.model
    : baseOpts.model

  const raw = await callJSON(userPrompt, {
    ...baseOpts,
    model,
    maxTokens: 512,
    systemPrompt,
  })
  return JSON.parse(raw) as NLCommandResult
}

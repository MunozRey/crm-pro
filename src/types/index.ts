// ─── Contact ────────────────────────────────────────────────────────────────

export type ContactStatus = 'prospect' | 'customer' | 'churned'
export type ContactSource = 'website' | 'referral' | 'outbound' | 'event' | 'linkedin' | 'other'

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  companyId: string
  status: ContactStatus
  source: ContactSource
  tags: string[]
  assignedTo: string
  createdAt: string
  updatedAt: string
  lastContactedAt: string
  notes: string
  linkedDeals: string[]
  avatar?: string
}

export type LeadLifecycleStage = 'subscriber' | 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer'
export type LeadStatus = 'open' | 'working' | 'qualified' | 'unqualified' | 'converted'

export interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  companyName?: string
  jobTitle?: string
  source: string
  status: LeadStatus
  lifecycleStage: LeadLifecycleStage
  score: number
  assignedTo?: string
  ownerUserId?: string
  tags: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  lastEngagedAt?: string
  convertedContactId?: string
  convertedCompanyId?: string
  convertedDealId?: string
}

// ─── Company ─────────────────────────────────────────────────────────────────

export type CompanyStatus = 'prospect' | 'customer' | 'partner' | 'churned'
export type CompanyIndustry =
  | 'fintech'
  | 'saas'
  | 'consulting'
  | 'insurance'
  | 'banking'
  | 'retail'
  | 'healthcare'
  | 'other'

export interface Company {
  id: string
  name: string
  domain: string
  industry: CompanyIndustry
  size: string
  country: string
  city: string
  website: string
  phone: string
  status: CompanyStatus
  revenue?: number
  contacts: string[]
  deals: string[]
  tags: string[]
  notes: string
  createdAt: string
  updatedAt: string
}

// ─── Deal ────────────────────────────────────────────────────────────────────

export type DealStage = string

export type DealCurrency = 'EUR' | 'USD' | 'GBP'
export type DealPriority = 'low' | 'medium' | 'high'

export interface Deal {
  id: string
  title: string
  value: number
  currency: DealCurrency
  stage: DealStage
  probability: number
  expectedCloseDate: string
  contactId: string
  companyId: string
  assignedTo: string
  priority: DealPriority
  source: string
  notes: string
  activities: string[]
  quoteItems?: QuoteItem[]
  createdAt: string
  updatedAt: string
}

// ─── Activity ────────────────────────────────────────────────────────────────

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task' | 'linkedin'
export type ActivityStatus = 'pending' | 'completed' | 'cancelled'

export interface Activity {
  id: string
  type: ActivityType
  subject: string
  description: string
  outcome?: string
  dueDate?: string
  completedAt?: string
  status: ActivityStatus
  contactId?: string
  companyId?: string
  dealId?: string
  createdBy: string
  createdAt: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface PipelineStage {
  id: string
  name: string
  color: string
  order: number
  probability: number
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
}

export interface AppSettings {
  currency: DealCurrency
  themePreference: 'system' | 'light' | 'dark'
  pipelineStages: PipelineStage[]
  leadSlaHours: number
  permissionProfiles: Record<import('./auth').UserRole, import('./auth').Permission[]>
  branding: {
    appName: string
    primaryColor: string
    logoUrl?: string
    customDomain?: string
    privacyUrl?: string
    termsUrl?: string
  }
  tags: string[]
  users: User[]
  googleClientId?: string
  emailIdentities?: Record<string, {
    senderName?: string
    signature?: string
    useSignature: boolean
    defaultSignatureId?: string
    signatures?: Array<{
      id: string
      name: string
      html: string
      createdAt: string
      updatedAt: string
    }>
  }>
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ContactFilters {
  search: string
  status: ContactStatus | ''
  source: ContactSource | ''
  tags: string[]
  assignedTo: string
  dateFrom: string
  dateTo: string
}

export interface CompanyFilters {
  search: string
  industry: CompanyIndustry | ''
  size: string
  status: CompanyStatus | ''
  country: string
}

export interface DealFilters {
  search: string
  stage: DealStage | ''
  assignedTo: string
  priority: DealPriority | ''
  valueMin: string
  valueMax: string
  dueDateFrom: string
  dueDateTo: string
}

export interface ActivityFilters {
  search: string
  type: ActivityType | ''
  status: ActivityStatus | ''
  contactId: string
  dealId: string
  dateFrom: string
  dateTo: string
}

// ─── AI Enrichment ───────────────────────────────────────────────────────────

export interface ContactEnrichment {
  leadScore: number
  personalityType: string
  buyingSignals: string[]
  approachStrategy: string
  suggestedEmailOpener: string
  objectionHandlers: string[]
  insights: string
  enrichedAt: string
}

export interface DealEnrichment {
  winProbabilityAI: number
  executiveSummary: string
  keyRisks: string[]
  keyStrengths: string[]
  nextSteps: string[]
  talkingPoints: string[]
  competitiveContext: string
  enrichedAt: string
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AIConversation {
  id: string
  title: string
  messages: AIMessage[]
  createdAt: string
  updatedAt: string
}

// ─── Email ───────────────────────────────────────────────────────────────────

export type EmailStatus = 'draft' | 'scheduled' | 'sent' | 'received' | 'snoozed'

export interface CRMEmail {
  id: string
  ownerUserId?: string
  gmailMessageId?: string
  gmailThreadId?: string
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  attachments?: Array<{
    name: string
    mimeType: string
    size: number
  }>
  subject: string
  body: string
  htmlBody?: string
  status: EmailStatus
  contactId?: string
  dealId?: string
  companyId?: string
  createdAt: string
  sentAt?: string
  scheduledFor?: string
  trackingEnabled?: boolean
  openedAt?: string
  openCount?: number
  lastOpenedAt?: string
  clickCount?: number
  lastClickedAt?: string
  undoableUntil?: string
  isRead?: boolean
}

export interface GmailTokens {
  accessToken: string
  expiresAt: number
}

export interface GmailThread {
  id: string
  snippet: string
  historyId: string
  messages: GmailMessage[]
}

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  to: string
  cc?: string
  bcc?: string
  replyTo?: string
  subject: string
  snippet: string
  body: string
  date: string
  labelIds: string[]
  attachments?: GmailAttachment[]
}

export interface GmailAttachment {
  attachmentId: string
  filename: string
  mimeType: string
  size: number
}

export type InboxTrackingFilter = 'all' | 'tracked' | 'opened' | 'clicked'

export interface InboxAdvancedFilters {
  unreadOnly: boolean
  linkedOnly: boolean
  mineOnly: boolean
  hasAttachments: boolean
  tracking: InboxTrackingFilter
}

export interface InboxSavedView {
  id: string
  name: string
  query: string
  filters: InboxAdvancedFilters
  createdAt: string
  updatedAt: string
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalContacts: number
  openDeals: number
  pipelineValue: number
  wonThisMonth: number
}

// ─── Email Templates ────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'follow_up' | 'intro' | 'proposal' | 'closing' | 'nurture' | 'custom'
  variables: string[]  // e.g. ['{{firstName}}', '{{company}}', '{{dealTitle}}']
  createdAt: string
  updatedAt: string
  usageCount: number
}

// ─── Auto Lead Score ────────────────────────────────────────────────────────

export interface LeadScoreBreakdown {
  activityScore: number    // 0-25 based on activity count & recency
  engagementScore: number  // 0-25 based on email opens, replies
  profileScore: number     // 0-25 based on job title, company size
  dealScore: number        // 0-25 based on associated deal value/stage
  total: number            // 0-100
  factors: string[]        // human-readable factors
  calculatedAt: string
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export type AuditAction =
  | 'contact_created' | 'contact_updated' | 'contact_deleted'
  | 'deal_created' | 'deal_updated' | 'deal_deleted' | 'deal_stage_changed'
  | 'activity_created' | 'activity_completed' | 'activity_deleted'
  | 'email_sent' | 'enrichment_completed'
  | 'company_created' | 'company_updated'
  | 'lead_score_recomputed'
  | 'user_role_changed' | 'permission_profile_updated'

export interface AuditEntry {
  id: string
  action: AuditAction
  entityType: 'contact' | 'deal' | 'activity' | 'email' | 'company' | 'lead' | 'user' | 'settings'
  entityId: string
  entityName: string
  details: string
  userId: string
  timestamp: string
}

// ─── Sales Goals ────────────────────────────────────────────────────────────

export interface SalesGoal {
  id: string
  userId: string
  type: 'revenue' | 'deals_closed' | 'activities' | 'contacts_added'
  target: number
  current: number
  period: 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
}

// ─── Follow-up Reminder ─────────────────────────────────────────────────────

export interface FollowUpReminder {
  contactId: string
  contactName: string
  companyName: string
  daysSinceContact: number
  lastActivityType?: string
  lastActivityDate: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  suggestedAction: string
}

// ─── Notifications ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'deal_won'
  | 'deal_lost'
  | 'deal_stage_changed'
  | 'activity_overdue'
  | 'activity_assigned'
  | 'follow_up_due'
  | 'contact_assigned'
  | 'goal_achieved'
  | 'goal_at_risk'
  | 'mention'
  | 'system'

export interface CRMNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  entityType?: 'contact' | 'deal' | 'activity' | 'company' | 'goal' | 'lead'
  entityId?: string
  userId: string        // recipient
  triggeredBy?: string  // who caused it
  isRead: boolean
  createdAt: string
}

// ─── Duplicate Contact ──────────────────────────────────────────────────────

export interface DuplicateGroup {
  contacts: Contact[]
  matchType: 'email' | 'name' | 'phone'
  confidence: number  // 0-100
}

// ─── Email Sequences ─────────────────────────────────────────────────────────

export type SequenceStepType = 'email' | 'call_task' | 'linkedin_task' | 'wait'

export interface SequenceStep {
  id: string
  order: number
  type: SequenceStepType
  delayDays: number        // days after previous step
  subject?: string         // for email steps
  bodyTemplate?: string    // for email steps, supports {{firstName}}, {{companyName}}
  taskDescription?: string // for call/linkedin steps
}

export interface EmailSequence {
  id: string
  name: string
  description: string
  steps: SequenceStep[]
  createdBy: string
  createdAt: string
  isActive: boolean
  enrolledCount: number
}

export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'replied' | 'unsubscribed'

export interface SequenceEnrollment {
  id: string
  sequenceId: string
  contactId: string
  contactName: string
  currentStep: number      // 0-indexed
  status: EnrollmentStatus
  enrolledAt: string
  nextStepAt?: string      // when next step triggers
  completedAt?: string
}

// ─── Automations ─────────────────────────────────────────────────────────────

export type AutomationTriggerType =
  | 'deal_stage_changed'
  | 'deal_created'
  | 'deal_closed_won'
  | 'deal_closed_lost'
  | 'activity_completed'
  | 'contact_created'
  | 'follow_up_overdue'

export type AutomationActionType =
  | 'create_activity'
  | 'send_notification'
  | 'update_deal_stage'
  | 'assign_to_user'
  | 'add_tag'

export interface AutomationTrigger {
  type: AutomationTriggerType
  // For deal_stage_changed: which stage triggers this
  fromStage?: DealStage
  toStage?: DealStage
}

export interface AutomationAction {
  type: AutomationActionType
  // create_activity
  activityType?: ActivityType
  activitySubject?: string
  activityDaysFromNow?: number
  // send_notification
  notificationTitle?: string
  notificationMessage?: string
  // update_deal_stage
  newStage?: DealStage
  // assign_to_user
  userId?: string
  // add_tag
  tag?: string
}

export interface AutomationRule {
  id: string
  name: string
  description: string
  isActive: boolean
  trigger: AutomationTrigger
  actions: AutomationAction[]
  executionCount: number
  lastExecutedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AutomationExecutionLog {
  id: string
  ruleId: string
  triggerType: AutomationTriggerType
  status: 'success' | 'error'
  context: Record<string, unknown>
  result: Record<string, unknown>
  errorMessage?: string
  createdAt: string
}

// ─── Products & Quotes ───────────────────────────────────────────────────────

export type ProductCategory = 'software' | 'hardware' | 'service' | 'consulting' | 'support' | 'other'

export interface Product {
  id: string
  name: string
  description: string
  sku: string
  price: number
  currency: DealCurrency
  category: ProductCategory
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface QuoteItem {
  id: string
  productId?: string
  name: string
  description?: string
  quantity: number
  unitPrice: number
  discount: number  // percentage 0-100
  total: number     // quantity * unitPrice * (1 - discount/100)
}

// ─── Custom Fields ───────────────────────────────────────────────────────────

export type CustomFieldEntityType = 'contact' | 'company' | 'deal'

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'currency'
  | 'textarea'

export interface CustomFieldDefinition {
  id: string
  entityType: CustomFieldEntityType
  label: string
  fieldType: CustomFieldType
  placeholder?: string
  options?: string[]        // for select/multiselect
  required: boolean
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomFieldDefinitionI18n {
  fieldId: string
  languageCode: 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it'
  label: string
  placeholder?: string
  options?: string[]
}

export interface CustomFieldValue {
  fieldId: string
  value: string | number | boolean | string[] | null
}

// ─── Smart Views ─────────────────────────────────────────────────────────────

export interface SmartViewFilter {
  field: string              // field key (e.g. 'status', 'source', 'assignedTo', or custom field id)
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'empty' | 'not_empty'
  value: string | number | boolean | string[]
}

export interface SmartView {
  id: string
  name: string
  nameKey?: string          // optional i18n key — overrides `name` when present
  entityType: CustomFieldEntityType
  filters: SmartViewFilter[]
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  isPinned: boolean
  icon?: string
  color?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ─── Document Attachments ────────────────────────────────────────────────────

export interface Attachment {
  id: string
  entityType: 'contact' | 'company' | 'deal'
  entityId: string
  fileName: string
  fileSize: number       // bytes
  mimeType: string
  data: string           // base64 encoded (demo — in prod would be S3 URL)
  uploadedBy: string
  uploadedAt: string
  notes?: string
}

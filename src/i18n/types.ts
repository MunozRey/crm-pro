export type Language = 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it'

export interface Translations {
  // ─── Navigation ──────────────────────────────────────────────────────────────
  nav: {
    dashboard: string
    contacts: string
    companies: string
    deals: string
    timeline: string
    calendar: string
    activities: string
    followUps: string
    goals: string
    notifications: string
    inbox: string
    reports: string
    forecast: string
    leaderboard: string
    templates: string
    sequences: string
    aiAssistant: string
    team: string
    products: string
    automations: string
    settings: string
    audit: string
    collapse: string
    expand: string
    collapseSidebar: string
    expandSidebar: string
  }

  // ─── Nav Sections ────────────────────────────────────────────────────────────
  navSections: {
    main: string
    sales: string
    comms: string
    ai: string
    config: string
  }

  // ─── Common ──────────────────────────────────────────────────────────────────
  common: {
    search: string
    filters: string
    clear: string
    save: string
    cancel: string
    delete: string
    edit: string
    create: string
    close: string
    confirm: string
    actions: string
    name: string
    email: string
    phone: string
    status: string
    notes: string
    tags: string
    createdAt: string
    updatedAt: string
    noResults: string
    loading: string
    export: string
    import: string
    reset: string
    view: string
    all: string
    selected: string
    selectAll: string
    select: string
    assignedTo: string
    back: string
    details: string
    add: string
    remove: string
    yes: string
    no: string
    ok: string
    or: string
    and: string
    of: string
    total: string
    showing: string
    from: string
    to: string
    previous: string
    next: string
    date: string
    type: string
    description: string
    value: string
    priority: string
    active: string
    inactive: string
    enabled: string
    disabled: string
    changeStatus: string
    bulkDelete: string
    bulkDeleteConfirm: string
    nSelected: string
    searchPlaceholder: string
  }

  // ─── Contact ─────────────────────────────────────────────────────────────────
  contacts: {
    title: string
    newContact: string
    editContact: string
    firstName: string
    lastName: string
    jobTitle: string
    company: string
    source: string
    score: string
    lastContacted: string
    duplicates: string
    duplicatesFound: string
    noDuplicates: string
    merge: string
    myContacts: string
    emptyTitle: string
    emptyDescription: string
    deleteConfirm: string
    created: string
    updated: string
    deleted: string
    bulkDeleted: string
    statusLabels: {
      prospect: string
      customer: string
      churned: string
    }
    sourceLabels: {
      website: string
      referral: string
      outbound: string
      event: string
      linkedin: string
      other: string
    }
  }

  // ─── Company ─────────────────────────────────────────────────────────────────
  companies: {
    title: string
    name: string
    newCompany: string
    editCompany: string
    domain: string
    domainPlaceholder: string
    industry: string
    size: string
    country: string
    city: string
    website: string
    revenue: string
    contactCount: string
    dealCount: string
    emptyTitle: string
    emptyDescription: string
    deleteConfirm: string
    created: string
    updated: string
    deleted: string
    bulkDeleted: string
    statusLabels: {
      prospect: string
      customer: string
      partner: string
      churned: string
    }
    industryLabels: {
      fintech: string
      saas: string
      consulting: string
      insurance: string
      banking: string
      retail: string
      healthcare: string
      other: string
    }
  }

  // ─── Deal ────────────────────────────────────────────────────────────────────
  deals: {
    title: string
    newDeal: string
    editDeal: string
    stage: string
    probability: string
    expectedClose: string
    contact: string
    company: string
    pipeline: string
    kanban: string
    list: string
    won: string
    lost: string
    aging: string
    daysInStage: string
    quote: string
    quoteBuilder: string
    addItem: string
    subtotal: string
    discount: string
    quoteNumber: string
    vatPercent: string
    validityDays: string
    emptyTitle: string
    emptyDescription: string
    deleteConfirm: string
    created: string
    updated: string
    deleted: string
    stageLabels: {
      lead: string
      qualified: string
      proposal: string
      negotiation: string
      closed_won: string
      closed_lost: string
    }
    priorityLabels: {
      low: string
      medium: string
      high: string
    }
  }

  // ─── Activity ────────────────────────────────────────────────────────────────
  activities: {
    title: string
    newActivity: string
    editActivity: string
    subject: string
    outcome: string
    dueDate: string
    completedAt: string
    overdue: string
    upcoming: string
    completed: string
    pending: string
    cancelled: string
    emptyTitle: string
    emptyDescription: string
    typeLabels: {
      call: string
      email: string
      meeting: string
      note: string
      task: string
      linkedin: string
    }
    statusLabels: {
      pending: string
      completed: string
      cancelled: string
    }
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: {
    title: string
    totalContacts: string
    openDeals: string
    pipelineValue: string
    wonThisMonth: string
    revenueByMonth: string
    dealFunnel: string
    recentActivities: string
    topDeals: string
    activityHeatmap: string
    quickActions: string
    newContact: string
    newDeal: string
    newActivity: string
    monthlyQuota: string
    quotaProgress: string
    dayLabels: string[]
    salesVelocity: string
    conversionRate: string
    teamLeaderboard: string
    latestNotifications: string
    closed: string
    remaining: string
    avgCloseTime: string
    days: string
    dealsClosedLabel: string
    activeDealsLabel: string
    heatmapLess: string
    heatmapMore: string
    viewAll: string
    viewPipeline: string
    viewNotifications: string
    noData: string
  }

  // ─── Calendar ────────────────────────────────────────────────────────────────
  calendar: {
    title: string
    today: string
    month: string
    week: string
    day: string
    newEvent: string
    noEvents: string
  }

  // ─── Settings ────────────────────────────────────────────────────────────────
  settings: {
    title: string
    general: string
    currency: string
    language: string
    tags: string
    addTag: string
    pipeline: string
    customFields: string
    fieldName: string
    fieldType: string
    entityType: string
    required: string
    placeholder: string
    options: string
    aiConfig: string
    apiKey: string
    apiKeyPlaceholder: string
    gmailIntegration: string
    connected: string
    disconnected: string
    connect: string
    disconnect: string
    notifications: string
    importExport: string
    exportData: string
    importData: string
    resetData: string
    resetConfirm: string
    dangerZone: string
    entityLabels: {
      contact: string
      company: string
      deal: string
    }
    fieldTypeLabels: {
      text: string
      number: string
      date: string
      select: string
      multiselect: string
      checkbox: string
      url: string
      email: string
      currency: string
      textarea: string
    }
    notifTypeLabels: {
      deal_won: string
      deal_lost: string
      deal_stage_changed: string
      activity_overdue: string
      activity_assigned: string
      follow_up_due: string
      contact_assigned: string
      goal_achieved: string
      goal_at_risk: string
      mention: string
      system: string
    }
    // ── Additional text used in Settings page ─────────────────────────
    apiKeyConfigured: string
    apiKeyHint: string
    gmailConnected: string
    gmailDisconnected: string
    gmailConnectionActive: string
    gmailEnterClientId: string
    gmailConnectedSuccess: string
    gmailSetupTitle: string
    gmailSetupStep1: string
    gmailSetupStep2: string
    gmailSetupStep3: string
    gmailSetupStep4: string
    fieldPlaceholderHint: string
    optionsPlaceholder: string
    valuePlaceholderHint: string
    requiredToggleOn: string
    requiredToggleOff: string
    activeToggleOn: string
    activeToggleOff: string
    editField: string
    deleteField: string
    newTagPlaceholder: string
    deleteTagAriaLabel: string
    users: string
    usersAuthHint: string
    pipelineReorderHint: string
    currencyLabels: {
      eur: string
      usd: string
      gbp: string
    }
  }

  // ─── Reports ─────────────────────────────────────────────────────────────────
  reports: {
    title: string
    salesOverview: string
    performance: string
    pipeline: string
    conversionRate: string
    activityReport: string
    periodLabel: string
    thisMonth: string
    lastMonth: string
    thisQuarter: string
    thisYear: string
  }

  // ─── Other pages ─────────────────────────────────────────────────────────────
  followUps: {
    title: string
    urgency: string
    daysSince: string
    suggestedAction: string
    critical: string
    high: string
    medium: string
    low: string
  }

  goals: {
    title: string
    revenue: string
    dealsClosed: string
    activitiesCompleted: string
    contactsAdded: string
    monthly: string
    quarterly: string
    yearly: string
    progress: string
    onTrack: string
    atRisk: string
    behind: string
  }

  forecast: {
    title: string
    weighted: string
    bestCase: string
    committed: string
    expected: string
  }

  leaderboard: {
    title: string
    rank: string
    user: string
    dealsWon: string
    revenue: string
    conversionRate: string
    subtitle: string
    podiumTitle: string
    fullRanking: string
    teamAchievements: string
    achievementsLegend: string
    achievements: string
    salesRep: string
    activePipeline: string
    activities: string
    successRate: string
    score: string
    totalRevenue: string
    thisMonth: string
    thisQuarter: string
    thisYear: string
    success: string
    // Badge labels
    firstDeal: string
    firstDealDesc: string
    winStreak: string
    winStreakDesc: string
    activityMachine: string
    activityMachineDesc: string
    topPerformer: string
    topPerformerDesc: string
    bigDeal: string
    bigDealDesc: string
    // Achievement descriptions for the badges section
    firstDealFull: string
    winStreakFull: string
    activityMachineFull: string
    topPerformerFull: string
    bigDealFull: string
    // Stats
    teamStats: string
    noAchievements: string
  }

  sequences: {
    title: string
    newSequence: string
    steps: string
    enrolled: string
    active: string
    paused: string
  }

  automations: {
    title: string
    newRule: string
    trigger: string
    action: string
    executionCount: string
    lastExecuted: string
  }

  products: {
    title: string
    newProduct: string
    sku: string
    price: string
    category: string
    categoryLabels: {
      software: string
      hardware: string
      service: string
      consulting: string
      support: string
      other: string
    }
  }

  team: {
    title: string
    members: string
    role: string
    permissions: string
    invite: string
    roleLabels: {
      admin: string
      manager: string
      sales_rep: string
      viewer: string
    }
    roleDescriptions: {
      admin: string
      manager: string
      sales_rep: string
      viewer: string
    }
    // ── Extended keys used by TeamManagement ──────────────────────────────
    newUser: string
    createUser: string
    inviteByEmail: string
    invitationValidity: string
    pendingInvitations: string
    expires: string
    activeSection: string
    activeMembersCount: string
    inactiveSection: string
    you: string
    noJobTitle: string
    lastLogin: string
    never: string
    changeRole: string
    resetPassword: string
    deactivateUser: string
    reactivate: string
    planInfo: string
    // Labels for the add-user / invite forms
    labelName: string
    labelEmail: string
    labelPassword: string
    labelJobTitle: string
    // Placeholders
    placeholderFullName: string
    placeholderEmail: string
    placeholderMinPassword: string
    placeholderJobTitle: string
    placeholderNewPassword: string
    // Toast messages
    toastFillRequired: string
    toastPasswordMin: string
    toastUserCreated: string
    toastUserCreateError: string
    toastEnterEmail: string
    toastInviteSent: string
    toastPasswordMin6: string
    toastPasswordReset: string
    toastInviteCancelled: string
    toastUserDeactivated: string
    toastUserReactivated: string
    toastRoleUpdated: string
  }

  audit: {
    title: string
    action: string
    entity: string
    user: string
    timestamp: string
  }

  emailTemplates: {
    title: string
    newTemplate: string
    category: string
    variables: string
    usageCount: string
    categoryLabels: {
      follow_up: string
      intro: string
      proposal: string
      closing: string
      nurture: string
      custom: string
    }
  }

  inbox: {
    title: string
    compose: string
    sent: string
    drafts: string
    noMessages: string
    markRead: string
    markUnread: string
    archive: string
    trash: string
    replyAll: string
    pinnedLink: string
    autoLink: string
    pinLink: string
    unpin: string
    saveLink: string
    contactPlaceholder: string
    dealPlaceholder: string
    refreshInbox: string
    selectThread: string
    selectedCount: string
    threadUpdated: string
    appliedToThreads: string
    followUpCreated: string
    noEntityToPin: string
    pinnedLinkRemoved: string
    manualLinkSaved: string
    downloadAttachmentError: string
    attachments: string
    crmSentInThread: string
    scheduled: string
    unknownSender: string
    clicks: string
    searchPlaceholder: string
    loadMore: string
    disconnectError: string
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    login: string
    register: string
    logout: string
    email: string
    password: string
    confirmPassword: string
    forgotPassword: string
    rememberMe: string
    loginButton: string
    registerButton: string
    noAccount: string
    hasAccount: string
    profile: string
    editProfile: string
    forgotPasswordTitle: string
    checkEmailTitle: string
    checkEmailSent: string
    checkEmailInstructions: string
    sendLink: string
    backToLogin: string
    realAuthEnabled: string
    emailPlaceholder: string
    checkEmailConfirmation: string
    passwordsDoNotMatch: string
    passwordMinLength: string
    savePassword: string
  }

  // ─── Org Setup ───────────────────────────────────────────────────────────────
  orgSetup: {
    title: string
    subtitle: string
    orgNameLabel: string
    orgNamePlaceholder: string
    slugLabel: string
    slugHint: string
    createButton: string
    errorNameRequired: string
    errorSlugRequired: string
    errorNotConfigured: string
    errorNotAuthenticated: string
  }

  // ─── Invitations ─────────────────────────────────────────────────────────────
  invitations: {
    invalidToken: string
    invalidOrExpired: string
    alreadyAccepted: string
    expired: string
  }

  acceptInvite: {
    invalidTitle: string
    loginCta: string
    welcomeTo: string
    redirecting: string
    joinOrg: string
    invitedToTeam: string
    organization: string
    assignedRole: string
    acceptCta: string
    roleAdmin: string
    roleManager: string
    roleSalesRep: string
    roleViewer: string
  }

  errorBoundary: {
    title: string
    fallbackDescription: string
    retry: string
  }

  commandPalette: {
    dealsCategory: string
    navigateHint: string
    openHint: string
    closeHint: string
  }

  // ─── Errors ──────────────────────────────────────────────────────────────────
  errors: {
    supabaseNotConfigured: string
    generic: string
    gmailConnectionError: string
    invitationSendError: string
    duplicateTag: string
    noPermissionTitle: string
    noPermissionDescription: string
  }

  // ─── Email ───────────────────────────────────────────────────────────────────
  email: {
    gmailApiLabel: string
    googleClientIdLabel: string
    ccLabel: string
    bccLabel: string
    replyToLabel: string
    closeComposer: string
    discardDraftConfirm: string
    addFile: string
    sendLater: string
    scheduleSendTime: string
    attachHint: string
    emailScheduled: string
  }

  // ─── Notifications page ──────────────────────────────────────────────────────
  notifications: {
    unread: string
    markAllRead: string
    clearAll: string
    emptyTitle: string
    emptyDescription: string
    today: string
    older: string
    markRead: string
  }

  // ─── Pipeline Timeline page ──────────────────────────────────────────────────
  // ─── Default Smart Views ─────────────────────────────────────────────────────
  views: {
    sv01: string
    sv02: string
    sv03: string
    sv04: string
    sv05: string
  }

  timeline: {
    title: string
    subtitle: string
    dealsInView: string
    totalPipeline: string
    weightedForecast: string
    expectedWinRate: string
    allStages: string
    allSalesReps: string
    dealColumn: string
    noDealsTitle: string
    noDealsHint: string
    closeLabel: string
    probabilityShort: string
  }
}

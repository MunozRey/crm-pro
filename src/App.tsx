import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { initSupabaseAuth } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Contacts } from './pages/Contacts'
import { ContactDetail } from './pages/ContactDetail'
import { Companies } from './pages/Companies'
import { CompanyDetail } from './pages/CompanyDetail'
import { Deals } from './pages/Deals'
import { Activities } from './pages/Activities'
import { Settings } from './pages/Settings'
import { Inbox } from './pages/Inbox'
import { EmailTemplates } from './pages/EmailTemplates'
import { FollowUps } from './pages/FollowUps'
import { AuditLog } from './pages/AuditLog'
import { SalesGoals } from './pages/SalesGoals'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { OrgSetup } from './pages/OrgSetup'
import { AcceptInvite } from './pages/AcceptInvite'
import { TeamManagement } from './pages/TeamManagement'
import { UserProfile } from './pages/UserProfile'
import { Notifications } from './pages/Notifications'
import { PipelineTimeline } from './pages/PipelineTimeline'
import { Sequences } from './pages/Sequences'
import { Automations } from './pages/Automations'
import { Products } from './pages/Products'
import { Calendar } from './pages/Calendar'
import { useTranslations } from './i18n'
import { useDataInit } from './hooks/useDataInit'
import { GmailTokenProvider } from './contexts/GmailTokenContext'
import { GmailCallback } from './pages/GmailCallback'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))
const Forecast = lazy(() => import('./pages/Forecast').then((m) => ({ default: m.Forecast })))

function ProtectedPage({ title, children, requiredPermission }: { title: string; children: React.ReactNode; requiredPermission?: import('./types/auth').Permission }) {
  return (
    <ProtectedRoute requiredPermission={requiredPermission}>
      <Layout title={title}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Layout>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  const t = useTranslations()
  useDataInit()
  const lazyFallback = <div className="p-6 text-sm text-slate-400">{t.common.loading}</div>
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/org-setup" element={<OrgSetup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/auth/gmail/callback" element={<GmailCallback />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedPage title={t.nav.dashboard}>
            <Suspense fallback={lazyFallback}>
              <Dashboard />
            </Suspense>
          </ProtectedPage>
        }
      />
      <Route path="/contacts" element={<ProtectedPage title={t.nav.contacts} requiredPermission="contacts:read"><Contacts /></ProtectedPage>} />
      <Route path="/contacts/:id" element={<ProtectedPage title={t.nav.contacts} requiredPermission="contacts:read"><ContactDetail /></ProtectedPage>} />
      <Route path="/companies" element={<ProtectedPage title={t.nav.companies} requiredPermission="companies:read"><Companies /></ProtectedPage>} />
      <Route path="/companies/:id" element={<ProtectedPage title={t.nav.companies} requiredPermission="companies:read"><CompanyDetail /></ProtectedPage>} />
      <Route path="/deals" element={<ProtectedPage title={t.nav.deals} requiredPermission="deals:read"><Deals /></ProtectedPage>} />
      <Route path="/activities" element={<ProtectedPage title={t.nav.activities} requiredPermission="activities:read"><Activities /></ProtectedPage>} />
      <Route
        path="/reports"
        element={
          <ProtectedPage title={t.nav.reports} requiredPermission="reports:read">
            <Suspense fallback={lazyFallback}>
              <Reports />
            </Suspense>
          </ProtectedPage>
        }
      />
      <Route path="/inbox" element={<ProtectedPage title={t.nav.inbox} requiredPermission="email:read"><Inbox /></ProtectedPage>} />
      <Route path="/settings" element={<ProtectedPage title={t.nav.settings} requiredPermission="settings:read"><Settings /></ProtectedPage>} />
      <Route path="/templates" element={<ProtectedPage title={t.nav.templates} requiredPermission="templates:read"><EmailTemplates /></ProtectedPage>} />
      <Route path="/follow-ups" element={<ProtectedPage title={t.nav.followUps} requiredPermission="contacts:read"><FollowUps /></ProtectedPage>} />
      <Route path="/audit" element={<ProtectedPage title={t.nav.audit} requiredPermission="audit:read"><AuditLog /></ProtectedPage>} />
      <Route path="/goals" element={<ProtectedPage title={t.nav.goals} requiredPermission="goals:read"><SalesGoals /></ProtectedPage>} />
      <Route path="/team" element={<ProtectedPage title={t.nav.team} requiredPermission="users:read"><TeamManagement /></ProtectedPage>} />
      <Route path="/notifications" element={<ProtectedPage title={t.nav.notifications}><Notifications /></ProtectedPage>} />
      <Route path="/timeline" element={<ProtectedPage title={t.nav.timeline} requiredPermission="deals:read"><PipelineTimeline /></ProtectedPage>} />
      <Route
        path="/forecast"
        element={
          <ProtectedPage title={t.nav.forecast} requiredPermission="reports:read">
            <Suspense fallback={lazyFallback}>
              <Forecast />
            </Suspense>
          </ProtectedPage>
        }
      />
      <Route path="/sequences" element={<ProtectedPage title={t.nav.sequences} requiredPermission="sequences:read"><Sequences /></ProtectedPage>} />
      <Route path="/automations" element={<ProtectedPage title={t.nav.automations} requiredPermission="automations:read"><Automations /></ProtectedPage>} />
      <Route path="/products" element={<ProtectedPage title={t.nav.products} requiredPermission="products:read"><Products /></ProtectedPage>} />
      <Route path="/calendar" element={<ProtectedPage title={t.nav.calendar} requiredPermission="activities:read"><Calendar /></ProtectedPage>} />
      <Route path="/profile" element={<ProtectedPage title={t.auth.profile}><UserProfile /></ProtectedPage>} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    const cleanup = initSupabaseAuth()
    return cleanup
  }, [])
  return (
    <BrowserRouter>
      <GmailTokenProvider>
        <AppRoutes />
      </GmailTokenProvider>
    </BrowserRouter>
  )
}

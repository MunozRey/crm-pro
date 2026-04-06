import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useAIStore } from '../../store/aiStore'
import { useContactsStore } from '../../store/contactsStore'
import { useCompaniesStore } from '../../store/companiesStore'
import { useDealsStore } from '../../store/dealsStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { generateMeetingPrep } from '../../services/aiService'
import type { MeetingPrep } from '../../services/aiService'

interface MeetingPrepModalProps {
  isOpen: boolean
  onClose: () => void
  contactId: string
  dealId?: string
}

export function MeetingPrepModal({ isOpen, onClose, contactId, dealId }: MeetingPrepModalProps) {
  const openRouterKey = useAIStore((s) => s.openRouterKey)

  const contact = useContactsStore((s) => s.contacts.find((c) => c.id === contactId))
  const companies = useCompaniesStore((s) => s.companies)
  const deals = useDealsStore((s) => s.deals)
  const activities = useActivitiesStore((s) => s.activities)

  const company = contact ? companies.find((c) => c.id === contact.companyId) : undefined
  const deal = dealId ? deals.find((d) => d.id === dealId) : undefined

  const [loading, setLoading] = useState(false)
  const [prep, setPrep] = useState<MeetingPrep | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    if (!openRouterKey || !contact) return

    const recentActivities = activities
      .filter((a) => a.contactId === contactId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)

    setPrep(null)
    setError(null)
    setLoading(true)

    generateMeetingPrep({ contact, company, deal, recentActivities })
      .then((result) => {
        setPrep(result)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to generate meeting prep.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Meeting Prep" size="2xl">
      {/* No API key configured */}
      {!openRouterKey && (
        <p className="text-sm text-slate-500 py-8 text-center">
          Configure your OpenRouter API key in Settings.
        </p>
      )}

      {/* Error state */}
      {error && openRouterKey && (
        <p className="text-sm text-red-400 py-8 text-center">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl btn-gradient flex items-center justify-center animate-pulse">
            <Sparkles size={18} className="text-white" />
          </div>
          <p className="text-sm text-slate-400 animate-pulse">Preparing your meeting briefing...</p>
        </div>
      )}

      {/* Content */}
      {prep && !loading && (
        <div className="space-y-5">
          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-brand-500/8 border border-brand-500/15">
            <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider mb-2">Situation</p>
            <p className="text-sm text-slate-200 leading-relaxed">{prep.executiveSummary}</p>
          </div>

          {/* Opening Line */}
          <div className="p-4 rounded-xl bg-violet-500/8 border border-violet-500/15">
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-2">Opening Line</p>
            <p className="text-sm text-slate-200 italic leading-relaxed">"{prep.openingLine}"</p>
          </div>

          {/* Two columns: Key Topics + Red Flags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Topics</p>
              <ul className="space-y-1.5">
                {prep.keyTopics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-white/8 flex items-center justify-center text-[9px] text-slate-500 flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
            {prep.redFlags.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">
                  ⚠ Watch Out
                </p>
                <ul className="space-y-1.5">
                  {prep.redFlags.map((flag, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                      <span className="text-red-400 flex-shrink-0">·</span> {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Likely Objections */}
          {prep.likelyObjections.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Likely Objections
              </p>
              <div className="space-y-2">
                {prep.likelyObjections.map((obj, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/4 border border-white/6">
                    <p className="text-xs font-medium text-amber-300 mb-1">"{obj.objection}"</p>
                    <p className="text-xs text-slate-400">{obj.response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desired Outcome */}
          <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              Goal for This Meeting
            </p>
            <p className="text-sm text-slate-200">{prep.desiredOutcome}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}

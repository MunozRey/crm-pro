import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, DealCurrency } from '../types'
import { seedSettings } from '../utils/seedData'
import { LS_KEYS } from '../utils/constants'
import type { Permission, UserRole } from '../types/auth'

interface SettingsState {
  settings: AppSettings

  updateThemePreference: (themePreference: AppSettings['themePreference']) => void
  updateCurrency: (currency: DealCurrency) => void
  updateLeadSlaHours: (hours: number) => void
  updatePermissionProfile: (role: UserRole, permissions: Permission[]) => void
  updateBranding: (updates: Partial<AppSettings['branding']>) => void
  updateGoogleClientId: (clientId: string) => void
  updateEmailIdentity: (userId: string, identity: {
    senderName?: string
    signature?: string
    useSignature: boolean
    defaultSignatureId?: string
  }) => void
  upsertEmailSignature: (userId: string, signature: {
    id?: string
    name: string
    html: string
  }) => string
  deleteEmailSignature: (userId: string, signatureId: string) => void
  setDefaultEmailSignature: (userId: string, signatureId: string) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  addPipelineStage: (stage: Omit<AppSettings['pipelineStages'][number], 'order'>) => void
  reorderStages: (stages: AppSettings['pipelineStages']) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: seedSettings,

      updateThemePreference: (themePreference) => {
        set((state) => ({ settings: { ...state.settings, themePreference } }))
      },

      updateCurrency: (currency) => {
        set((state) => ({ settings: { ...state.settings, currency } }))
      },

      updateLeadSlaHours: (hours) => {
        set((state) => ({ settings: { ...state.settings, leadSlaHours: Math.max(1, Math.floor(hours) || 8) } }))
      },

      updatePermissionProfile: (role, permissions) => {
        set((state) => ({
          settings: {
            ...state.settings,
            permissionProfiles: {
              ...(state.settings.permissionProfiles ?? {}),
              [role]: Array.from(new Set(permissions)),
            },
          },
        }))
      },

      updateBranding: (updates) => {
        set((state) => ({
          settings: {
            ...state.settings,
            branding: {
              ...state.settings.branding,
              ...updates,
            },
          },
        }))
      },

      updateGoogleClientId: (clientId) => {
        set((state) => ({ settings: { ...state.settings, googleClientId: clientId.trim() || undefined } }))
      },

      updateEmailIdentity: (userId, identity) => {
        set((state) => ({
          // Keep backwards compatibility while migrating to multi-signature identities.
          settings: {
            ...state.settings,
            emailIdentities: {
              ...(state.settings.emailIdentities ?? {}),
              [userId]: {
                ...(state.settings.emailIdentities?.[userId] ?? {}),
                senderName: identity.senderName?.trim() || undefined,
                signature: identity.signature?.trim() || undefined,
                useSignature: identity.useSignature,
                defaultSignatureId: identity.defaultSignatureId ?? state.settings.emailIdentities?.[userId]?.defaultSignatureId,
              },
            },
          },
        }))
      },

      upsertEmailSignature: (userId, signature) => {
        const signatureId = signature.id ?? `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        set((state) => {
          const identity = state.settings.emailIdentities?.[userId] ?? { useSignature: true }
          const previous = identity.signatures ?? []
          const now = new Date().toISOString()
          const next = previous.some((s) => s.id === signatureId)
            ? previous.map((s) => (s.id === signatureId
              ? { ...s, name: signature.name.trim() || 'Signature', html: signature.html.trim(), updatedAt: now }
              : s))
            : [...previous, {
              id: signatureId,
              name: signature.name.trim() || 'Signature',
              html: signature.html.trim(),
              createdAt: now,
              updatedAt: now,
            }]
          const fallbackDefault = identity.defaultSignatureId ?? next[0]?.id
          const selected = next.find((s) => s.id === fallbackDefault)
          return {
            settings: {
              ...state.settings,
              emailIdentities: {
                ...(state.settings.emailIdentities ?? {}),
                [userId]: {
                  ...identity,
                  signatures: next,
                  defaultSignatureId: fallbackDefault,
                  signature: selected?.html ?? identity.signature,
                },
              },
            },
          }
        })
        return signatureId
      },

      deleteEmailSignature: (userId, signatureId) => {
        set((state) => {
          const identity = state.settings.emailIdentities?.[userId]
          if (!identity) return state
          const nextSignatures = (identity.signatures ?? []).filter((s) => s.id !== signatureId)
          const nextDefault = identity.defaultSignatureId === signatureId ? nextSignatures[0]?.id : identity.defaultSignatureId
          const selected = nextSignatures.find((s) => s.id === nextDefault)
          return {
            settings: {
              ...state.settings,
              emailIdentities: {
                ...(state.settings.emailIdentities ?? {}),
                [userId]: {
                  ...identity,
                  signatures: nextSignatures,
                  defaultSignatureId: nextDefault,
                  signature: selected?.html ?? '',
                },
              },
            },
          }
        })
      },

      setDefaultEmailSignature: (userId, signatureId) => {
        set((state) => {
          const identity = state.settings.emailIdentities?.[userId]
          if (!identity) return state
          const selected = (identity.signatures ?? []).find((s) => s.id === signatureId)
          if (!selected) return state
          return {
            settings: {
              ...state.settings,
              emailIdentities: {
                ...(state.settings.emailIdentities ?? {}),
                [userId]: {
                  ...identity,
                  defaultSignatureId: signatureId,
                  signature: selected.html,
                },
              },
            },
          }
        })
      },

      addTag: (tag) => {
        set((state) => ({
          settings: { ...state.settings, tags: [...state.settings.tags, tag] },
        }))
      },

      removeTag: (tag) => {
        set((state) => ({
          settings: {
            ...state.settings,
            tags: state.settings.tags.filter((t) => t !== tag),
          },
        }))
      },

      addPipelineStage: (stage) => {
        set((state) => {
          const order = state.settings.pipelineStages.length
          return {
            settings: {
              ...state.settings,
              pipelineStages: [...state.settings.pipelineStages, { ...stage, order }],
            },
          }
        })
      },

      reorderStages: (stages) => {
        set((state) => ({ settings: { ...state.settings, pipelineStages: stages } }))
      },

      resetToDefaults: () => {
        set({ settings: seedSettings })
      },
    }),
    {
      name: LS_KEYS.settings,
    }
  )
)

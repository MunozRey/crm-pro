import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../../src/store/settingsStore'

describe('settingsStore email identity', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults()
  })

  it('stores per-user email identities', () => {
    useSettingsStore.getState().updateEmailIdentity('user-a', {
      senderName: 'Alice AE',
      signature: 'Best regards',
      useSignature: true,
    })
    useSettingsStore.getState().updateEmailIdentity('user-b', {
      senderName: 'Bob SDR',
      signature: 'Thanks',
      useSignature: false,
    })

    const identities = useSettingsStore.getState().settings.emailIdentities ?? {}
    expect(identities['user-a']?.senderName).toBe('Alice AE')
    expect(identities['user-a']?.useSignature).toBe(true)
    expect(identities['user-b']?.senderName).toBe('Bob SDR')
    expect(identities['user-b']?.useSignature).toBe(false)
  })
})

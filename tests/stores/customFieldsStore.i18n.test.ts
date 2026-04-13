import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCustomFieldsStore } from '../../src/store/customFieldsStore'
import { useI18nStore } from '../../src/i18n'

vi.mock('../../src/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}))

describe('customFieldsStore i18n', () => {
  beforeEach(() => {
    useI18nStore.setState({ language: 'en' })
    useCustomFieldsStore.setState({
      definitions: [{
        id: 'cf-1',
        entityType: 'contact',
        label: 'Department',
        fieldType: 'select',
        options: ['Sales', 'Marketing'],
        required: false,
        order: 1,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }],
      translations: [],
      values: {},
      isLoading: false,
      error: null,
    })
  })

  it('returns canonical labels when no translation exists for language', () => {
    const defs = useCustomFieldsStore.getState().getDefinitionsForEntity('contact')
    expect(defs[0]?.label).toBe('Department')
  })

  it('returns localized metadata for current language when translation exists', () => {
    useCustomFieldsStore.getState().upsertTranslation('cf-1', 'es', {
      label: 'Departamento',
      options: ['Ventas', 'Marketing'],
      placeholder: 'Selecciona un departamento',
    })
    useI18nStore.setState({ language: 'es' })

    const defs = useCustomFieldsStore.getState().getDefinitionsForEntity('contact')
    expect(defs[0]?.label).toBe('Departamento')
    expect(defs[0]?.placeholder).toBe('Selecciona un departamento')
    expect(defs[0]?.options).toEqual(['Ventas', 'Marketing'])
  })
})

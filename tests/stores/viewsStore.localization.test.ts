import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('viewsStore legacy localization migration', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('assigns nameKey to legacy views by known translated names', async () => {
    localStorage.setItem('crm_views', JSON.stringify({
      state: {
        views: [
          {
            id: 'custom-1',
            name: 'Prospects actifs',
            entityType: 'contact',
            filters: [],
            sortField: 'updatedAt',
            sortDirection: 'desc',
            isPinned: true,
            createdBy: 'test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'custom-2',
            name: 'Deals in Verhandlung',
            entityType: 'deal',
            filters: [],
            sortField: 'value',
            sortDirection: 'desc',
            isPinned: true,
            createdBy: 'test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'custom-3',
            name: 'Aziende SaaS',
            entityType: 'company',
            filters: [],
            sortField: 'name',
            sortDirection: 'asc',
            isPinned: true,
            createdBy: 'test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        activeViewId: { contact: null, company: null, deal: null },
      },
      version: 0,
    }))

    const { useViewsStore } = await import('../../src/store/viewsStore')
    await useViewsStore.persist.rehydrate()
    const views = useViewsStore.getState().views

    expect(views.find((v) => v.id === 'custom-1')?.nameKey).toBe('sv01')
    expect(views.find((v) => v.id === 'custom-2')?.nameKey).toBe('sv03')
    expect(views.find((v) => v.id === 'custom-3')?.nameKey).toBe('sv05')
  })

  it('creates and deletes inbox saved views', async () => {
    const { useViewsStore } = await import('../../src/store/viewsStore')
    const created = useViewsStore.getState().addInboxView('My unread', 'from:vip', {
      unreadOnly: true,
      linkedOnly: false,
      mineOnly: true,
      hasAttachments: false,
      tracking: 'all',
    })

    expect(created.id).toBeTruthy()
    expect(useViewsStore.getState().inboxViews).toHaveLength(1)
    expect(useViewsStore.getState().inboxViews[0]?.name).toBe('My unread')

    useViewsStore.getState().deleteInboxView(created.id)
    expect(useViewsStore.getState().inboxViews).toHaveLength(0)
  })
})

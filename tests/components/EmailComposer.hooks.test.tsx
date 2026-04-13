import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GmailTokenProvider } from '../../src/contexts/GmailTokenContext'
import { EmailComposer } from '../../src/components/email/EmailComposer'

function renderComposer(isOpen: boolean) {
  return render(
    <GmailTokenProvider>
      <EmailComposer isOpen={isOpen} onClose={() => {}} />
    </GmailTokenProvider>,
  )
}

describe('EmailComposer hooks stability', () => {
  it('keeps hooks order stable when toggling open state', () => {
    const { rerender } = renderComposer(false)

    expect(() => {
      rerender(
        <GmailTokenProvider>
          <EmailComposer isOpen onClose={() => {}} />
        </GmailTokenProvider>,
      )
    }).not.toThrow()
  })
})

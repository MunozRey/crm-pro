export interface InboxQueryCandidate {
  from: string
  to: string[]
  subject: string
  snippet: string
  body: string
  unread: boolean
  hasAttachment: boolean
  tracked: boolean
  opened: boolean
  clicked: boolean
  mine: boolean
}

function includesNormalized(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

export function buildInboxQueryMatcher(query: string): (candidate: InboxQueryCandidate) => boolean {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!tokens.length) return () => true

  return (candidate) => {
    const toJoined = candidate.to.join(', ')
    const genericText = [candidate.from, toJoined, candidate.subject, candidate.snippet, candidate.body].join(' ')

    for (const token of tokens) {
      const lowerToken = token.toLowerCase()
      if (lowerToken.startsWith('from:')) {
        const value = token.slice(5)
        if (!value || !includesNormalized(candidate.from, value)) return false
        continue
      }
      if (lowerToken.startsWith('to:')) {
        const value = token.slice(3)
        if (!value || !includesNormalized(toJoined, value)) return false
        continue
      }
      if (lowerToken.startsWith('subject:')) {
        const value = token.slice(8)
        if (!value || !includesNormalized(candidate.subject, value)) return false
        continue
      }
      if (lowerToken === 'has:attachment') {
        if (!candidate.hasAttachment) return false
        continue
      }
      if (lowerToken === 'is:unread') {
        if (!candidate.unread) return false
        continue
      }
      if (lowerToken === 'is:tracked') {
        if (!candidate.tracked) return false
        continue
      }
      if (lowerToken === 'is:opened') {
        if (!candidate.opened) return false
        continue
      }
      if (lowerToken === 'is:clicked') {
        if (!candidate.clicked) return false
        continue
      }
      if (lowerToken === 'in:mine') {
        if (!candidate.mine) return false
        continue
      }
      if (!includesNormalized(genericText, token)) return false
    }
    return true
  }
}

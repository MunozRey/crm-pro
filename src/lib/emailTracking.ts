export interface TrackingLinkRow {
  click_token: string
  original_url: string
}

export function rewriteLinksForTracking(
  htmlBody: string,
  clickBaseUrl: string,
): { htmlBody: string; links: TrackingLinkRow[] } {
  const links: TrackingLinkRow[] = []
  const seen = new Map<string, string>()

  const rewritten = htmlBody.replace(/https?:\/\/[^\s<>"')]+/gi, (matchedUrl) => {
    const existingToken = seen.get(matchedUrl)
    const clickToken = existingToken ?? crypto.randomUUID()
    if (!existingToken) {
      seen.set(matchedUrl, clickToken)
      links.push({ click_token: clickToken, original_url: matchedUrl })
    }
    const trackedUrl = new URL(clickBaseUrl)
    trackedUrl.searchParams.set('token', clickToken)
    return trackedUrl.toString()
  })

  return { htmlBody: rewritten, links }
}

export function injectOpenPixel(htmlBody: string, openPixelUrl: string): string {
  const pixel = `<img src="${openPixelUrl}" width="1" height="1" style="display:none" alt="" />`
  if (/<\/body>/i.test(htmlBody)) {
    return htmlBody.replace(/<\/body>/i, `${pixel}</body>`)
  }
  return `${htmlBody}\n${pixel}`
}

export function normalizeBodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  return escaped.replace(/\n/g, '<br/>')
}

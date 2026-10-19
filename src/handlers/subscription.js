import { getSubscription } from '../lib/store.js'
import { error, methodNotAllowed, notFound, SECURITY_HEADERS } from '../lib/http.js'
import { DEFAULT_CONTENT_TYPE, isDomainAllowed, isValidId } from '../../shared/subscription.js'
import { isBlockedCrawler } from '../lib/bots.js'

function matchesEtag(header, etag) {
  return (header ?? '').split(',').some((value) => {
    const candidate = value.trim()
    return candidate === '*' || candidate.replace(/^W\//, '') === etag
  })
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(filename.toWellFormed()).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

const BLOCKED = '禁止访问'
const DENIED = '无权访问'

function countryOf(request) {
  return String(request.cf?.country || request.headers.get('CF-IPCountry') || '')
    .trim()
    .toUpperCase()
}

export async function handleSubscription(request, env, id) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
  if (!isValidId(id)) return notFound()
  if (isBlockedCrawler(request)) return error(403, BLOCKED)

  const sub = await getSubscription(env, id)
  if (!sub) return notFound()

  if (sub.allowedCountries.length) {
    const country = countryOf(request)
    if (!country || !sub.allowedCountries.includes(country)) return error(403, DENIED)
  }

  if (sub.allowedDomains.length && !isDomainAllowed(new URL(request.url).hostname, sub.allowedDomains)) {
    return error(403, DENIED)
  }

  const headers = new Headers({
    ...SECURITY_HEADERS,
    'Content-Type': sub.contentType || DEFAULT_CONTENT_TYPE,
    'Cache-Control': sub.allowedCountries.length ? 'no-store' : 'public, max-age=3600',
    Vary: 'User-Agent',
    'X-Subscription-Id': sub.id,
    'Content-Disposition': contentDisposition(sub.filename),
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })

  if (sub.updatedAt) headers.set('Last-Modified', new Date(sub.updatedAt).toUTCString())
  if (sub.sha256) headers.set('ETag', `"${sub.sha256}"`)
  if (sub.subscriptionUserinfo) headers.set('Subscription-Userinfo', sub.subscriptionUserinfo)

  if (matchesEtag(request.headers.get('If-None-Match'), headers.get('ETag'))) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(request.method === 'HEAD' ? null : sub.content, { status: 200, headers })
}

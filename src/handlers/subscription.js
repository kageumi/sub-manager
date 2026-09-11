import { getSubscription } from '../lib/store.js'
import { error, methodNotAllowed, notFound } from '../lib/http.js'
import { isValidId } from '../lib/validate.js'
import { isBlockedCrawler } from '../lib/bots.js'
import { DEFAULT_CONTENT_TYPE, isDomainAllowed } from '../lib/metadata.js'

function quoteEtag(value) {
  return `"${value}"`
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
    'Content-Type': sub.contentType || DEFAULT_CONTENT_TYPE,
    'Cache-Control': sub.allowedCountries.length ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'X-Subscription-Id': sub.id,
    'Content-Disposition': `inline; filename="${sub.filename}"`,
    'Access-Control-Allow-Origin': '*',
  })

  if (sub.updatedAt) headers.set('Last-Modified', new Date(sub.updatedAt).toUTCString())
  if (sub.sha256) headers.set('ETag', quoteEtag(sub.sha256))
  if (sub.subscriptionUserinfo) headers.set('Subscription-Userinfo', sub.subscriptionUserinfo)

  if (sub.sha256 && request.headers.get('If-None-Match') === quoteEtag(sub.sha256)) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(request.method === 'HEAD' ? null : sub.content, { status: 200, headers })
}

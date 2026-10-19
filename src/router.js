import { handlePage } from './handlers/page.js'
import { handleLoginRequest, handleLogoutRequest, handleSessionRequest } from './handlers/auth.js'
import { handleAsset } from './handlers/assets.js'
import { handleRobots } from './handlers/robots.js'
import { handleApi } from './handlers/api.js'
import { handleSubscription } from './handlers/subscription.js'
import { error, isSameOriginRequest, methodNotAllowed, notFound, text } from './lib/http.js'

const GET_ONLY = new Set(['/', '/robots.txt', '/favicon.ico', '/favicon.svg'])

export async function route(request, env) {
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  url.pathname = pathname

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (pathname === '/_health') return text('ok')

  if (GET_ONLY.has(pathname) && request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed()
  }

  if (pathname.startsWith('/assets/') && request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed()
  }

  if (
    pathname.startsWith('/api/') &&
    request.method !== 'GET' &&
    request.method !== 'HEAD' &&
    !isSameOriginRequest(request)
  ) {
    return error(403, '跨站请求已被拒绝')
  }

  if (pathname === '/') return handlePage()

  if (pathname.startsWith('/assets/') || pathname === '/favicon.svg') {
    const asset = await handleAsset(request, env)
    if (asset) return asset
  }

  if (pathname === '/robots.txt') return handleRobots()
  if (pathname === '/favicon.ico') return new Response(null, { status: 204 })

  if (pathname === '/api/session') return handleSessionRequest(request, env)
  if (pathname === '/api/login') return handleLoginRequest(request, env)
  if (pathname === '/api/logout') return handleLogoutRequest(request)
  if (pathname === '/api/subs') return handleApi(request, env, url)
  if (/^\/api\/subs\/[^/]+$/.test(pathname)) return handleApi(request, env, url)

  const id = pathname.slice(1)
  if (id && !id.includes('/')) return handleSubscription(request, env, id)

  return notFound()
}

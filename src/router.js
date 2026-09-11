import { handleLanding } from './handlers/landing.js'
import { handleAdmin } from './handlers/home.js'
import { handleLoginPage } from './handlers/login.js'
import { handleLoginRequest, handleLogoutRedirect, handleLogoutRequest } from './handlers/auth.js'
import { handleAsset } from './handlers/assets.js'
import { handleRobots } from './handlers/robots.js'
import { handleFont } from './handlers/font.js'
import { handleApi } from './handlers/api.js'
import { handleSubscription } from './handlers/subscription.js'
import { error, isSameOriginRequest, methodNotAllowed, notFound, text } from './lib/http.js'

const GET_ONLY = new Set([
  '/',
  '/admin',
  '/login',
  '/app.js',
  '/login.js',
  '/app.css',
  '/robots.txt',
  '/fonts/material-symbols.woff2',
  '/favicon.ico',
])

export async function route(request, env) {
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (pathname === '/_health') return text('ok')

  if (GET_ONLY.has(pathname) && request.method !== 'GET' && request.method !== 'HEAD') {
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

  if (pathname === '/') return handleLanding(request, env)
  if (pathname === '/admin') return handleAdmin(request, env)
  if (pathname === '/login') return handleLoginPage(request, env)
  if (pathname === '/logout') return handleLogoutRedirect()

  const asset = handleAsset(pathname)
  if (asset) return asset

  if (pathname === '/robots.txt') return handleRobots()
  if (pathname === '/fonts/material-symbols.woff2') return handleFont()
  if (pathname === '/favicon.ico') return new Response(null, { status: 204 })

  if (pathname === '/api/login') return handleLoginRequest(request, env)
  if (pathname === '/api/logout') return handleLogoutRequest()
  if (pathname === '/api/subs') return handleApi(request, env, url)
  if (/^\/api\/subs\/[^/]+$/.test(pathname)) return handleApi(request, env, url)

  const id = pathname.slice(1)
  if (id && !id.includes('/')) return handleSubscription(request, env, id)

  return notFound()
}

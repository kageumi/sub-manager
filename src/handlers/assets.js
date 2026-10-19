import { SECURITY_HEADERS } from '../lib/http.js'

// Vite writes the site icon to dist root; hashed build assets live under /assets/.
const STATIC_ASSETS = new Set(['/favicon.svg'])

export async function handleAsset(request, env) {
  const url = new URL(request.url)
  const hashed = url.pathname.startsWith('/assets/')
  if (!hashed && !STATIC_ASSETS.has(url.pathname)) return null

  const response = await env.ASSETS.fetch(request)
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value)

  if (response.status === 200) {
    headers.set('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

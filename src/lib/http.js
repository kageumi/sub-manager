const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000',
}

const MAX_JSON_BYTES = 26 * 1024 * 1024

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...headers },
  })
}

export function text(body, { status = 200, contentType = 'text/plain; charset=utf-8', headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType, ...SECURITY_HEADERS, ...headers },
  })
}

export function html(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...headers,
    },
  })
}

export function error(status, message) {
  return json({ error: message }, { status })
}

export function unauthorized() {
  return error(401, '登录状态已失效，请重新登录')
}

export function notFound() {
  return error(404, '未找到')
}

export function methodNotAllowed() {
  return error(405, '请求方法不受支持')
}

export function redirect(location, { status = 302, headers = {} } = {}) {
  return new Response(null, { status, headers: { Location: location, ...headers } })
}

export async function readJson(request, { maxBytes = MAX_JSON_BYTES } = {}) {
  const mediaType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  if (mediaType !== 'application/json') {
    return { error: '请求内容类型必须为 application/json', status: 415 }
  }

  const length = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(length) && length > maxBytes) {
    return { error: '请求内容过大', status: 413 }
  }

  try {
    return { body: await request.json() }
  } catch {
    return { error: '请求内容不是合法的 JSON', status: 400 }
  }
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get('Origin')
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return false
    } catch {
      return false
    }
  }

  const site = request.headers.get('Sec-Fetch-Site')
  if (site && site !== 'same-origin' && site !== 'none') return false

  return true
}

export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self' https://esm.sh",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://esm.sh",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

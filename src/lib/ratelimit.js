const encoder = new TextEncoder()

const PREFIX = '_rl:'
const DEFAULT_MAX_ATTEMPTS = 20
const DEFAULT_WINDOW_SECONDS = 900

function config(env) {
  const max = Number(env.LOGIN_MAX_ATTEMPTS)
  const window = Number(env.LOGIN_WINDOW_SECONDS)
  return {
    max: Number.isFinite(max) && max >= 0 ? max : DEFAULT_MAX_ATTEMPTS,
    window: Number.isFinite(window) && window > 0 ? window : DEFAULT_WINDOW_SECONDS,
  }
}

async function clientKey(request) {
  const ip = request.headers.get('CF-Connecting-IP')
  if (!ip) return null

  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(ip))
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${PREFIX}${hex}`
}

export async function isLoginRateLimited(env, request) {
  const { max } = config(env)
  if (max === 0) return false

  const key = await clientKey(request)
  if (!key || !env.SUB) return false

  const count = Number(await env.SUB.get(key))
  return Number.isFinite(count) && count >= max
}

export async function recordLoginFailure(env, request) {
  const { max, window } = config(env)
  if (max === 0) return

  const key = await clientKey(request)
  if (!key || !env.SUB) return

  const count = Number(await env.SUB.get(key)) || 0
  await env.SUB.put(key, String(count + 1), { expirationTtl: Math.max(60, window) })
}

export async function clearLoginFailures(env, request) {
  const key = await clientKey(request)
  if (!key || !env.SUB) return
  await env.SUB.delete(key)
}

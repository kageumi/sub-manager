import { accessPassword } from './config.js'
import { SESSION_COOKIE, parseCookies, verifySession } from './session.js'

const encoder = new TextEncoder()

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

async function secureEqual(left, right) {
  const a = await digest(left)
  const b = await digest(right)
  return crypto.subtle.timingSafeEqual(a, b)
}

export async function isAuthenticated(request, env) {
  const token = parseCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
  return verifySession(env, token)
}

export async function verifyPassword(env, value) {
  const expected = accessPassword(env)
  if (!expected) return false
  return secureEqual(String(value ?? ''), expected)
}

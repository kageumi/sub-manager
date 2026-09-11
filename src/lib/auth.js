import { adminPassword, adminUsername } from './config.js'
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

export async function verifyCredentials(env, username, password) {
  const expectedUser = adminUsername(env)
  const expectedPass = adminPassword(env)
  if (!expectedUser || !expectedPass) return false

  const userMatches = await secureEqual(String(username ?? ''), expectedUser)
  const passMatches = await secureEqual(String(password ?? ''), expectedPass)
  return userMatches && passMatches
}

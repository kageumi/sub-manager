import { adminUsername, sessionSecret } from './config.js'

const encoder = new TextEncoder()
const keyCache = new Map()

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_COOKIE = 'sub_admin_session'

function bytesToBase64url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importKey(env) {
  const secret = sessionSecret(env)
  let key = keyCache.get(secret)
  if (!key) {
    key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    if (keyCache.size >= 8) keyCache.delete(keyCache.keys().next().value)
    keyCache.set(secret, key)
  }
  return key
}

async function sign(env, payload) {
  const signature = await crypto.subtle.sign('HMAC', await importKey(env), encoder.encode(payload))
  return bytesToBase64url(new Uint8Array(signature))
}

function equalStrings(a, b) {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.byteLength !== right.byteLength) return false
  return crypto.subtle.timingSafeEqual(left, right)
}

export async function createSession(env, username, ttl = SESSION_TTL_MS) {
  const payload = bytesToBase64url(
    encoder.encode(JSON.stringify({ u: String(username ?? ''), exp: Date.now() + ttl })),
  )
  return `${payload}.${await sign(env, payload)}`
}

export async function verifySession(env, token) {
  if (typeof token !== 'string') return false

  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payload, signature] = parts

  if (!equalStrings(signature, await sign(env, payload))) return false

  let session
  try {
    session = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload)))
  } catch {
    return false
  }

  if (!session || typeof session.exp !== 'number' || session.exp < Date.now()) return false
  return equalStrings(String(session.u ?? ''), adminUsername(env))
}

export function parseCookies(header) {
  const cookies = {}
  if (!header) return cookies

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const name = part.slice(0, index).trim()
    if (!name) continue
    const value = part.slice(index + 1).trim()
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
    }
  }
  return cookies
}

export function sessionCookie(token, secure) {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`]
  if (secure) attributes.push('Secure')
  return `${SESSION_COOKIE}=${token}; ${attributes.join('; ')}`
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
}

export function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === 'https:'
  } catch {
    return false
  }
}

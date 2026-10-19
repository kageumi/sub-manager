import { isAuthenticated, verifyPassword } from '../lib/auth.js'
import { hasPassword } from '../lib/config.js'
import { error, json, methodNotAllowed, readJson } from '../lib/http.js'
import { clearLoginFailures, isLoginRateLimited, recordLoginFailure } from '../lib/ratelimit.js'
import { clearSessionCookie, createSession, isSecureRequest, sessionCookie } from '../lib/session.js'

export async function handleLoginRequest(request, env) {
  if (request.method !== 'POST') return methodNotAllowed()
  if (!hasPassword(env)) {
    return error(503, '请配置至少 8 位的访问密码')
  }

  if (await isLoginRateLimited(env, request)) {
    return error(429, '登录尝试过于频繁，请稍后再试')
  }

  const parsed = await readJson(request, { maxBytes: 4096 })
  if (parsed.error) return error(parsed.status ?? 400, parsed.error)

  const { password } = parsed.body ?? {}
  if (typeof password !== 'string' || password.length > 1024) {
    return error(400, '密码格式不正确')
  }

  if (!(await verifyPassword(env, password))) {
    await recordLoginFailure(env, request)
    return error(401, '密码错误')
  }

  await clearLoginFailures(env, request)

  const token = await createSession(env)
  return json(
    { ok: true },
    {
      headers: { 'Set-Cookie': sessionCookie(token, isSecureRequest(request)) },
    },
  )
}

export async function handleSessionRequest(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
  return json({ authenticated: await isAuthenticated(request, env) })
}

export function handleLogoutRequest(request) {
  if (request.method !== 'POST') return methodNotAllowed()
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } })
}

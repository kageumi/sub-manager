import { verifyCredentials } from '../lib/auth.js'
import { hasCredentials } from '../lib/config.js'
import { error, json, readJson } from '../lib/http.js'
import { clearLoginFailures, isLoginRateLimited, recordLoginFailure } from '../lib/ratelimit.js'
import { clearSessionCookie, createSession, isSecureRequest, sessionCookie } from '../lib/session.js'

export async function handleLoginRequest(request, env) {
  if (!hasCredentials(env)) {
    return error(500, '服务端未配置登录凭据')
  }

  if (await isLoginRateLimited(env, request)) {
    return error(429, '登录尝试过于频繁，请稍后再试')
  }

  const parsed = await readJson(request, { maxBytes: 4096 })
  if (parsed.error) return error(parsed.status ?? 400, parsed.error)

  const { username, password } = parsed.body ?? {}
  if (!(await verifyCredentials(env, username, password))) {
    await recordLoginFailure(env, request)
    return error(401, '用户名或密码错误')
  }

  await clearLoginFailures(env, request)

  const token = await createSession(env, username)
  return json(
    { ok: true },
    {
      headers: { 'Set-Cookie': sessionCookie(token, isSecureRequest(request)) },
    },
  )
}

export function handleLogoutRequest() {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } })
}

export function handleLogoutRedirect() {
  return new Response(null, {
    status: 302,
    headers: { Location: '/login', 'Set-Cookie': clearSessionCookie() },
  })
}

const DEFAULT_SITE_NAME = '订阅管理器'

export function siteName(env) {
  return String(env?.SITE_NAME || DEFAULT_SITE_NAME)
}

export function adminUsername(env) {
  return String(env?.AUTH_USER || '')
}

export function adminPassword(env) {
  return String(env?.AUTH_PASS || '')
}

export function hasCredentials(env) {
  return Boolean(adminUsername(env) && adminPassword(env))
}

export function sessionSecret(env) {
  return String(env?.SESSION_SECRET || `${adminUsername(env)}:${adminPassword(env)}`)
}

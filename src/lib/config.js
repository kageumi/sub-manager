export function accessPassword(env) {
  return String(env?.PASSWORD || '')
}

export function hasPassword(env) {
  return accessPassword(env).length >= 8
}

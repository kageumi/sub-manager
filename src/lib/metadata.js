export const DEFAULT_CONTENT_TYPE = 'text/plain; charset=utf-8'
export const MAX_CONTENT_BYTES = 24 * 1024 * 1024
export const MAX_COUNTRIES = 20
export const MAX_DOMAINS = 10
export const MAX_DOMAIN_LIST_CHARS = 256

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const HTML_TAGS = /<[^>]*>/g
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/

const encoder = new TextEncoder()

export function sanitizeHeaderValue(value) {
  if (value === undefined || value === null) return ''
  const text = String(value).trim()
  return !text || /[\r\n]/.test(text) ? '' : text.slice(0, 512)
}

export function sanitizeFilename(value) {
  const text = sanitizeHeaderValue(value)
  return text ? text.replace(/[\\"]/g, '').slice(0, 120) : ''
}

export function normalizeCountryList(input) {
  if (input == null) return []
  const parts = Array.isArray(input) ? input : String(input).split(/[\s,;|]+/)
  const codes = new Set()
  for (const part of parts) {
    const code = String(part).trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(code)) codes.add(code)
    if (codes.size >= MAX_COUNTRIES) break
  }
  return [...codes]
}

export function normalizeDomain(value) {
  let domain = String(value || '')
    .trim()
    .toLowerCase()
  if (!domain) return ''
  domain = domain
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
  if (domain.startsWith('*.')) {
    const base = domain.slice(2)
    return DOMAIN_PATTERN.test(base) ? `*.${base}` : ''
  }
  return DOMAIN_PATTERN.test(domain) ? domain : ''
}

export function normalizeDomainList(input) {
  if (input == null) return []
  const parts = Array.isArray(input) ? input : String(input).split(/[\s,;|]+/)
  const domains = []
  const seen = new Set()
  let total = 0
  for (const part of parts) {
    const domain = normalizeDomain(part)
    if (domain && !seen.has(domain) && total + domain.length <= MAX_DOMAIN_LIST_CHARS) {
      domains.push(domain)
      seen.add(domain)
      total += domain.length + 1
    }
    if (domains.length >= MAX_DOMAINS) break
  }
  return domains
}

export function isDomainAllowed(hostname, allowedDomains) {
  const host = normalizeDomain(hostname)
  if (!host) return false
  return allowedDomains.some((domain) => {
    if (domain.startsWith('*.')) {
      const base = domain.slice(1)
      return host.endsWith(base) && host.length > base.length
    }
    return domain === host
  })
}

export function toMetadata(id, source = {}) {
  const input = source && typeof source === 'object' ? source : {}
  const name =
    typeof input.name === 'string'
      ? input.name.replace(HTML_TAGS, '').replace(CONTROL_CHARS, '').trim().slice(0, 100)
      : ''
  return {
    name,
    contentType: (sanitizeHeaderValue(input.contentType) || DEFAULT_CONTENT_TYPE).slice(0, 80),
    filename: sanitizeFilename(input.filename) || `${id}.yaml`,
    subscriptionUserinfo: sanitizeHeaderValue(input.subscriptionUserinfo).slice(0, 128),
    allowedCountries: normalizeCountryList(input.allowedCountries ?? input.regions).join(','),
    allowedDomains: normalizeDomainList(input.allowedDomains).join(','),
    size: Number.isFinite(input.size) ? input.size : 0,
    sha256: sanitizeHeaderValue(input.sha256).slice(0, 64),
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : 0,
    updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : 0,
  }
}

export function fromMetadata(id, metadata = {}) {
  const source = metadata && typeof metadata === 'object' ? metadata : {}
  const base = toMetadata(id, source)
  return {
    id,
    name: base.name,
    contentType: base.contentType,
    filename: base.filename,
    subscriptionUserinfo: base.subscriptionUserinfo,
    allowedCountries: base.allowedCountries ? base.allowedCountries.split(',') : [],
    allowedDomains: base.allowedDomains ? base.allowedDomains.split(',') : [],
    size: base.size,
    sha256: base.sha256,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  }
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function byteLength(text) {
  return encoder.encode(text).byteLength
}

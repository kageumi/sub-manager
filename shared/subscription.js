export const DEFAULT_CONTENT_TYPE = 'text/plain; charset=utf-8'
export const MAX_CONTENT_BYTES = 24 * 1024 * 1024
const MAX_COUNTRIES = 20
const MAX_DOMAINS = 10
const MAX_DOMAIN_LIST_CHARS = 256

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g
const HTML_TAGS = /<[^>]*>/g
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/

const encoder = new TextEncoder()

function sanitizeHeaderValue(value) {
  if (value === undefined || value === null) return ''
  const text = String(value).trim()
  return !text || /[\u0000-\u001f\u007f]/.test(text) ? '' : text.slice(0, 512)
}

function sanitizeFilename(value) {
  const text = sanitizeHeaderValue(value)
  return text ? text.replace(/[\\"]/g, '').slice(0, 120) : ''
}

function sanitizeName(value) {
  return typeof value === 'string'
    ? value.replace(HTML_TAGS, '').replace(CONTROL_CHARS, '').trim().slice(0, 100)
    : ''
}

function splitMetadataList(value) {
  return value ? value.split(',') : []
}

function splitList(input) {
  const parts = Array.isArray(input) ? input : String(input ?? '').split(/[\s,，;；|]+/)
  return [...new Set(parts.map((part) => String(part).trim()).filter(Boolean))]
}

export function normalizeCountryList(input) {
  const parts = splitList(input)
  const codes = new Set()
  for (const part of parts) {
    const code = String(part).trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(code)) codes.add(code)
    if (codes.size >= MAX_COUNTRIES) break
  }
  return [...codes]
}

function normalizeDomain(value) {
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
  const parts = splitList(input)
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
  return {
    name: sanitizeName(input.name),
    contentType: (
      sanitizeHeaderValue(input.contentType).replace(/[^\x20-\xff]/g, '') || DEFAULT_CONTENT_TYPE
    ).slice(0, 80),
    filename: sanitizeFilename(input.filename) || `${id}.yaml`,
    subscriptionUserinfo: sanitizeHeaderValue(input.subscriptionUserinfo)
      .replace(/[^\x20-\xff]/g, '')
      .slice(0, 128),
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
    allowedCountries: splitMetadataList(base.allowedCountries),
    allowedDomains: splitMetadataList(base.allowedDomains),
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

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const RESERVED_IDS = new Set([
  '_health',
  'admin',
  'api',
  'app.css',
  'app.js',
  'assets',
  'favicon.ico',
  'fonts',
  'login',
  'login.js',
  'logout',
  'robots.txt',
])

export function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id) && !RESERVED_IDS.has(id.toLowerCase())
}

// Both callers reject invalid restrictions rather than silently allowing public access.
export function validateSubscriptionFields(input, { requireId = true } = {}) {
  const errors = {}
  if (requireId && !isValidId(typeof input.id === 'string' ? input.id.trim() : ''))
    errors.id = '以字母或数字开头，最多 128 位；仅支持 . _ -，不能使用系统保留名称。'
  if (!sanitizeName(input.name)) errors.name = '请填写订阅名称'
  else if (input.name.trim().length > 100) errors.name = '订阅名称不能超过 100 个字符'
  if (typeof input.content !== 'string' || !input.content.trim()) errors.content = '请填写订阅内容'
  else if (byteLength(input.content) > MAX_CONTENT_BYTES) errors.content = '订阅内容不能超过 24 MB'
  const countries = splitList(input.allowedCountries ?? input.regions)
  if (countries.some((code) => !/^[a-z]{2}$/i.test(code)))
    errors.allowedCountries = '请使用两位国家代码，例如 CN、US、JP'
  else if (new Set(countries.map((code) => code.toUpperCase())).size > MAX_COUNTRIES)
    errors.allowedCountries = '最多允许 20 个地区'
  const domains = splitList(input.allowedDomains).map(normalizeDomain)
  const uniqueDomains = [...new Set(domains)]
  if (domains.some((domain) => !domain))
    errors.allowedDomains = '请输入有效域名，例如 example.com 或 *.example.com'
  else if (uniqueDomains.length > MAX_DOMAINS || uniqueDomains.join(',').length > MAX_DOMAIN_LIST_CHARS)
    errors.allowedDomains = '最多允许 10 个域名，总长度不能超过 256 个字符'
  for (const key of ['contentType', 'filename', 'subscriptionUserinfo']) {
    const value = input[key]
    if (value == null) continue
    if (typeof value !== 'string') errors[key] = '响应设置必须为文本'
    else if (/[\u0000-\u001f\u007f]/.test(value)) errors[key] = '响应头不能包含换行或控制字符'
    else if (key !== 'filename' && /[^\x20-\xff]/.test(value)) errors[key] = '响应头只能使用 Latin-1 字符'
  }
  return errors
}

export function parseSubscription(body, options = {}) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const metadata = toMetadata(id, input)
  return {
    errors: Object.values(validateSubscriptionFields(input, options)),
    value: {
      id,
      content: typeof input.content === 'string' ? input.content : '',
      name: metadata.name,
      contentType: metadata.contentType,
      filename: metadata.filename,
      subscriptionUserinfo: metadata.subscriptionUserinfo,
      allowedCountries: splitMetadataList(metadata.allowedCountries),
      allowedDomains: splitMetadataList(metadata.allowedDomains),
    },
  }
}

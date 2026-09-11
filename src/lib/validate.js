import {
  MAX_CONTENT_BYTES,
  toMetadata,
  byteLength,
  normalizeCountryList,
  normalizeDomainList,
} from './metadata.js'

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

export function parseSubscription(body, { requireId = true } = {}) {
  const input = body && typeof body === 'object' ? body : {}
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const content = typeof input.content === 'string' ? input.content : ''

  const metadata = toMetadata(id, {
    name: input.name,
    contentType: input.contentType,
    filename: input.filename,
    subscriptionUserinfo: input.subscriptionUserinfo,
    allowedCountries: input.allowedCountries ?? input.regions,
    allowedDomains: input.allowedDomains,
  })

  const errors = []
  if (requireId && !isValidId(id)) {
    errors.push('订阅 ID 无效：需以字母或数字开头，只能包含字母、数字、.、_、-')
  }
  if (!metadata.name) {
    errors.push('请填写订阅名称')
  }
  if (!content.trim()) {
    errors.push('请填写订阅内容')
  } else if (byteLength(content) > MAX_CONTENT_BYTES) {
    errors.push(`订阅内容不能超过 ${Math.round(MAX_CONTENT_BYTES / 1024 / 1024)}MB`)
  }

  return {
    errors,
    value: {
      id,
      content,
      name: metadata.name,
      contentType: metadata.contentType,
      filename: metadata.filename,
      subscriptionUserinfo: metadata.subscriptionUserinfo,
      allowedCountries: normalizeCountryList(metadata.allowedCountries),
      allowedDomains: normalizeDomainList(metadata.allowedDomains),
    },
  }
}

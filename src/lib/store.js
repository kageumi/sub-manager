import { toMetadata, fromMetadata, sha256Hex } from '../../shared/subscription.js'

const encoder = new TextEncoder()

function kv(env) {
  return env.SUB
}

function parseRecord(raw) {
  if (!raw) return null
  try {
    const record = JSON.parse(raw)
    return record && typeof record === 'object' ? record : null
  } catch {
    return null
  }
}

function coerceStored(id, value, metadata) {
  if (metadata && typeof metadata === 'object') {
    return { content: value ?? '', metadata: fromMetadata(id, metadata) }
  }

  const legacy = parseRecord(value)
  if (legacy && typeof legacy.content === 'string') {
    return {
      content: legacy.content,
      metadata: fromMetadata(id, {
        ...legacy,
        allowedCountries: legacy.allowedCountries ?? legacy.regions,
        allowedDomains: legacy.allowedDomains,
        createdAt: legacy.createdAt ?? legacy.created,
        updatedAt: legacy.updatedAt ?? legacy.updated,
      }),
    }
  }

  return { content: value ?? '', metadata: fromMetadata(id, {}) }
}

export async function listSubscriptions(env) {
  const namespace = kv(env)
  const items = []
  let cursor

  do {
    const page = await namespace.list(cursor ? { cursor } : undefined)
    const keys = page.keys.filter((key) => !key.name.includes(':'))
    // Bound legacy reads rather than serializing every key or flooding KV at once.
    for (let offset = 0; offset < keys.length; offset += 10) {
      const batch = await Promise.all(
        keys.slice(offset, offset + 10).map(async (key) => {
          if (key.metadata) return fromMetadata(key.name, key.metadata)
          const stored = await namespace.getWithMetadata(key.name)
          if (stored.value == null) return null
          return coerceStored(key.name, stored.value, stored.metadata).metadata
        }),
      )
      items.push(...batch.filter(Boolean))
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  return items.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function getSubscription(env, id) {
  const stored = await kv(env).getWithMetadata(id)
  if (stored.value == null) return null
  const coerced = coerceStored(id, stored.value, stored.metadata)
  return {
    id,
    content: coerced.content,
    ...coerced.metadata,
  }
}

export async function saveSubscription(env, id, input, existing = null) {
  const content = typeof input.content === 'string' ? input.content : ''
  const bytes = encoder.encode(content)
  const now = Date.now()

  const metadata = toMetadata(id, {
    ...input,
    size: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })

  await kv(env).put(id, content, { metadata })
  return fromMetadata(id, metadata)
}

export async function removeSubscription(env, id) {
  await kv(env).delete(id)
}

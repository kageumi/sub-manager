import { toMetadata, fromMetadata, sha256Hex } from './metadata.js'

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
        name: legacy.name,
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
    for (const key of page.keys) {
      if (key.name.includes(':')) continue
      if (key.metadata) {
        const { id, ...meta } = fromMetadata(key.name, key.metadata)
        items.push({ id, ...meta })
        continue
      }
      const stored = await namespace.getWithMetadata(key.name)
      if (!stored.value) continue
      const { id, ...meta } = coerceStored(key.name, stored.value, null).metadata
      items.push({ id, ...meta })
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  return items.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
}

export async function getSubscription(env, id) {
  const stored = await kv(env).getWithMetadata(id)
  if (!stored.value) return null
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

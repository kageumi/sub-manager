import {
  validateSubscriptionFields,
  normalizeCountryList,
  normalizeDomainList,
} from '../../../shared/subscription.js'

export function emptyDraft() {
  return {
    id: '',
    name: '',
    content: '',
    contentType: '',
    filename: '',
    allowedCountries: '',
    allowedDomains: '',
    subscriptionUserinfo: '',
  }
}

export function draftFromSubscription(sub) {
  return Object.fromEntries(
    Object.keys(emptyDraft()).map((key) => [
      key,
      ['allowedCountries', 'allowedDomains'].includes(key) ? (sub[key] ?? []).join(', ') : (sub[key] ?? ''),
    ]),
  )
}

export function validateDraft(draft) {
  return validateSubscriptionFields(draft)
}

export function payloadFromDraft(draft) {
  return {
    ...draft,
    id: draft.id.trim(),
    name: draft.name.trim(),
    contentType: draft.contentType.trim(),
    filename: draft.filename.trim(),
    subscriptionUserinfo: draft.subscriptionUserinfo.trim(),
    allowedCountries: normalizeCountryList(draft.allowedCountries),
    allowedDomains: normalizeDomainList(draft.allowedDomains),
  }
}

export function isRestricted(sub) {
  return Boolean(sub.allowedCountries?.length || sub.allowedDomains?.length)
}

export function publicUrlFor(sub, origin) {
  const domain = (sub.allowedDomains ?? []).find((value) => !value.startsWith('*.'))
  return `${domain ? `https://${domain}` : origin}/${encodeURIComponent(sub.id)}`
}

export function matchesSearch(sub, query) {
  const searchable = [sub.id, sub.name, ...(sub.allowedCountries ?? []), ...(sub.allowedDomains ?? [])]
    .join(' ')
    .toLowerCase()
  return searchable.includes(query.trim().toLowerCase())
}

export const defaultListView = { query: '', filter: 'all', sort: 'updated', page: 1 }
export function selectSubscriptions(items, view, pageSize = 10) {
  const filtered = items
    .filter(
      (sub) =>
        matchesSearch(sub, view.query) &&
        (view.filter === 'all' || (view.filter === 'restricted') === isRestricted(sub)),
    )
    .sort((a, b) =>
      view.sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
    )
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.max(1, Math.min(view.page, pages))
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pages,
  }
}

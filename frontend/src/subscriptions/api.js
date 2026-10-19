import { requestJson } from '../shared/api.js'

const path = (id) => `/api/subs${id ? `/${encodeURIComponent(id)}` : ''}`
function requireSubscription(sub, content = false) {
  if (
    !sub ||
    typeof sub.id !== 'string' ||
    typeof sub.name !== 'string' ||
    (content && typeof sub.content !== 'string')
  )
    throw new Error('服务器返回的订阅数据不完整')
  return sub
}
export const subscriptionApi = {
  async list(signal) {
    const data = await requestJson(path(), { signal })
    if (!Array.isArray(data.subs)) throw new Error('服务器返回的列表数据不完整')
    return data.subs.map((sub) => requireSubscription(sub))
  },
  async get(id, signal) {
    return requireSubscription((await requestJson(path(id), { signal })).sub, true)
  },
  async save(payload, existingId) {
    const data = await requestJson(path(existingId), { method: existingId ? 'PUT' : 'POST', body: payload })
    const metadata = requireSubscription(data.sub)
    if (metadata.id !== (existingId || payload.id)) throw new Error('服务器返回的订阅 ID 不一致')
    return { ...metadata, content: payload.content }
  },
  async remove(id) {
    const data = await requestJson(path(id), { method: 'DELETE' })
    if (data.ok !== true) throw new Error('服务器未确认删除结果')
  },
}

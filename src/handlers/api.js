import { isAuthenticated } from '../lib/auth.js'
import { error, json, methodNotAllowed, readJson, unauthorized } from '../lib/http.js'
import { isValidId, parseSubscription } from '../lib/validate.js'
import { getSubscription, listSubscriptions, removeSubscription, saveSubscription } from '../lib/store.js'

const INVALID_ID = '订阅 ID 无效'
const NOT_FOUND = '订阅不存在'

async function list(env) {
  return json({ subs: await listSubscriptions(env) })
}

async function getOne(env, id) {
  if (!isValidId(id)) return error(400, INVALID_ID)
  const sub = await getSubscription(env, id)
  if (!sub) return error(404, NOT_FOUND)
  return json({ sub })
}

async function create(request, env) {
  const parsed = await readJson(request)
  if (parsed.error) return error(parsed.status ?? 400, parsed.error)

  const { errors, value } = parseSubscription(parsed.body)
  if (errors.length) return error(400, errors[0])
  if (await getSubscription(env, value.id)) return error(409, '订阅 ID 已存在，请更换一个')

  await saveSubscription(env, value.id, value)
  return json({ ok: true, id: value.id }, { status: 201 })
}

async function update(request, env, id) {
  if (!isValidId(id)) return error(400, INVALID_ID)

  const parsed = await readJson(request)
  if (parsed.error) return error(parsed.status ?? 400, parsed.error)

  const existing = await getSubscription(env, id)
  if (!existing) return error(404, NOT_FOUND)

  const { errors, value } = parseSubscription({ ...parsed.body, id }, { requireId: false })
  if (errors.length) return error(400, errors[0])

  await saveSubscription(env, id, value, existing)
  return json({ ok: true, id })
}

async function remove(env, id) {
  if (!isValidId(id)) return error(400, INVALID_ID)
  await removeSubscription(env, id)
  return json({ ok: true })
}

export async function handleApi(request, env, url) {
  if (!(await isAuthenticated(request, env))) return unauthorized()

  const id = url.pathname.split('/').filter(Boolean)[2]

  switch (request.method) {
    case 'GET':
      return id ? getOne(env, id) : list(env)
    case 'POST':
      return id ? methodNotAllowed() : create(request, env)
    case 'PUT':
      return id ? update(request, env, id) : methodNotAllowed()
    case 'DELETE':
      return id ? remove(env, id) : methodNotAllowed()
    default:
      return methodNotAllowed()
  }
}

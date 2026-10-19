import { describe, expect, test } from 'bun:test'
import { timingSafeEqual } from 'node:crypto'
import { readJson, isSameOriginRequest } from '../src/lib/http.js'
import { parseSubscription } from '../shared/subscription.js'
import { getSubscription, listSubscriptions, saveSubscription } from '../src/lib/store.js'
import { handleLoginRequest, handleLogoutRequest, handleSessionRequest } from '../src/handlers/auth.js'
import { handleSubscription } from '../src/handlers/subscription.js'
import { handleApi } from '../src/handlers/api.js'
import { createSession, verifySession, SESSION_COOKIE } from '../src/lib/session.js'

// Workers exposes this extension; Bun uses Node's equivalent in this test environment.
crypto.subtle.timingSafeEqual ??= timingSafeEqual

function namespace(initial = []) {
  const records = new Map(initial)
  return {
    async getWithMetadata(id) {
      return records.get(id) ?? { value: null, metadata: null }
    },
    async put(id, value, { metadata } = {}) {
      records.set(id, { value, metadata })
    },
    async delete(id) {
      records.delete(id)
    },
    async list() {
      return {
        keys: [...records].map(([name, record]) => ({ name, metadata: record.metadata })),
        list_complete: true,
      }
    },
  }
}
const input = (extra = {}) => ({ id: 'demo', name: '配置', content: 'proxies: []', ...extra })
const subscriptionRequest = (headers = {}) =>
  new Request('https://example.com/demo', {
    headers: { 'User-Agent': 'Clash', ...headers },
  })
const request = (body, headers = {}) =>
  new Request('https://example.com/api/subs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })

describe('请求边界', () => {
  test('按实际 UTF-8 字节限制 JSON，不信任缺失或虚假的 Content-Length', async () => {
    for (const headers of [{}, { 'Content-Length': '1' }]) {
      const parsed = await readJson(request(JSON.stringify({ value: '订阅' }), headers), { maxBytes: 16 })
      expect(parsed.status).toBe(413)
    }
    expect((await readJson(request('{"ok":true}'), { maxBytes: 11 })).body).toEqual({ ok: true })
  })
  test('流式读取保留跨块 UTF-8 字符，超限时取消剩余数据', async () => {
    const bytes = new TextEncoder().encode('{"name":"订阅"}')
    let offset = 0
    let cancelled = false
    const stream = () =>
      new ReadableStream({
        pull(controller) {
          if (offset === bytes.length) controller.close()
          else controller.enqueue(bytes.slice(offset, ++offset))
        },
        cancel() {
          cancelled = true
        },
      })
    const req = () =>
      new Request('https://example.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stream(),
        duplex: 'half',
      })
    expect((await readJson(req())).body).toEqual({ name: '订阅' })
    offset = 0
    expect((await readJson(req(), { maxBytes: 5 })).status).toBe(413)
    expect(cancelled).toBe(true)
  })
  test('拒绝非对象 JSON、无效 JSON 与错误媒体类型', async () => {
    for (const body of ['null', '[]', '42', '"text"', '{'])
      expect((await readJson(request(body))).status).toBe(400)
    expect((await readJson(request('{}', { 'Content-Type': 'text/plain' }))).status).toBe(415)
  })
  test('同源校验比较完整 origin，而不只是 host', () => {
    expect(isSameOriginRequest(request('{}', { Origin: 'https://example.com' }))).toBe(true)
    expect(isSameOriginRequest(request('{}', { Origin: 'http://example.com' }))).toBe(false)
    expect(isSameOriginRequest(request('{}', { Origin: 'null' }))).toBe(false)
  })
  test('会话接口限制请求方法，GET 不能退出登录', async () => {
    const env = { PASSWORD: 'test-password', LOGIN_MAX_ATTEMPTS: 0 }
    expect((await handleLoginRequest(new Request('https://example.com/api/login'), env)).status).toBe(405)
    expect(handleLogoutRequest(new Request('https://example.com/api/logout')).status).toBe(405)
    expect((await handleSessionRequest(request('{}'), env)).status).toBe(405)
  })
})

describe('输入规则', () => {
  test('API 拒绝无效访问限制，不能静默扩大访问权限', () => {
    for (const extra of [
      { allowedCountries: 'China' },
      { allowedDomains: ['example.com', 'invalid'] },
      { allowedDomains: Array.from({ length: 11 }, (_, i) => `a${i}.example.com`) },
    ])
      expect(parseSubscription(input(extra)).errors.length).toBeGreaterThan(0)
    expect(parseSubscription(input({ allowedCountries: 'cn，US；cn' })).value.allowedCountries).toEqual([
      'CN',
      'US',
    ])
  })
  test('API 不静默接受含换行或控制字符的响应设置', () => {
    for (const extra of [{ contentType: 'text/plain\r\nx: 1' }, { filename: 'bad\u0000.yaml' }])
      expect(parseSubscription(input(extra)).errors.length).toBeGreaterThan(0)
  })
})

describe('存储与公开订阅', () => {
  test('空字符串是已有记录，不是不存在；列表不会遗漏它', async () => {
    const env = { SUB: namespace([['empty', { value: '', metadata: null }]]) }
    expect((await getSubscription(env, 'empty'))?.content).toBe('')
    expect((await listSubscriptions(env)).map((sub) => sub.id)).toEqual(['empty'])
  })
  test('列表遍历所有 KV 分页，旧数据读取并发有上限且仍按更新时间排序', async () => {
    let active = 0
    let peak = 0
    const cursors = []
    const env = {
      SUB: {
        async list(options) {
          cursors.push(options?.cursor)
          if (options?.cursor)
            return {
              keys: [{ name: 'latest', metadata: { name: '新配置', updatedAt: 100 } }],
              list_complete: true,
            }
          return {
            keys: [
              ...Array.from({ length: 21 }, (_, index) => ({ name: `legacy-${index}` })),
              { name: '_rl:private' },
            ],
            list_complete: false,
            cursor: 'next',
          }
        },
        async getWithMetadata() {
          active++
          peak = Math.max(peak, active)
          await new Promise((resolve) => setTimeout(resolve, 1))
          active--
          return { value: JSON.stringify({ name: '旧配置', content: 'yaml', updatedAt: 1 }), metadata: null }
        },
      },
    }
    const items = await listSubscriptions(env)
    expect(cursors).toEqual([undefined, 'next'])
    expect(items).toHaveLength(22)
    expect(items[0].id).toBe('latest')
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(10)
  })
  test('保存并读取保留内容、元数据和创建时间', async () => {
    const env = { SUB: namespace() }
    const saved = await saveSubscription(env, 'demo', input())
    const stored = await getSubscription(env, 'demo')
    expect(stored.content).toBe(input().content)
    expect(stored.size).toBe(new TextEncoder().encode(input().content).byteLength)
    expect(stored.sha256).toHaveLength(64)
    const updated = await saveSubscription(env, 'demo', input({ content: '{}' }), saved)
    expect(updated.createdAt).toBe(saved.createdAt)
    expect(updated.sha256).not.toBe(saved.sha256)
  })
  test('兼容旧记录，不把配置 JSON 误判成旧数据', async () => {
    const env = {
      SUB: namespace([
        [
          'legacy',
          { value: JSON.stringify({ name: '旧配置', content: 'yaml', regions: ['CN'] }), metadata: null },
        ],
        ['modern', { value: '{"content":"raw"}', metadata: { name: '新配置' } }],
      ]),
    }
    expect((await getSubscription(env, 'legacy')).allowedCountries).toEqual(['CN'])
    expect((await getSubscription(env, 'modern')).content).toBe('{"content":"raw"}')
  })
  test('中文文件名可下载，响应包含统一安全头和标准 ETag 协商', async () => {
    const env = { SUB: namespace() }
    const saved = await saveSubscription(env, 'demo', input({ filename: '订阅.yaml' }))
    const response = await handleSubscription(subscriptionRequest(), env, 'demo')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain("filename*=UTF-8''%E8%AE%A2%E9%98%85.yaml")
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(response.headers.get('Vary')).toBe('User-Agent')
    for (const etag of [`W/"${saved.sha256}"`, `"other", "${saved.sha256}"`, '*']) {
      const cached = await handleSubscription(subscriptionRequest({ 'If-None-Match': etag }), env, 'demo')
      expect(cached.status).toBe(304)
    }
  })
  test('地区限制在缓存协商前执行，受限订阅不缓存', async () => {
    const env = { SUB: namespace() }
    await saveSubscription(env, 'demo', input({ allowedCountries: ['CN'] }))
    const denied = await handleSubscription(
      subscriptionRequest({ 'CF-IPCountry': 'US', 'If-None-Match': '*' }),
      env,
      'demo',
    )
    expect(denied.status).toBe(403)
    const allowed = await handleSubscription(subscriptionRequest({ 'CF-IPCountry': 'CN' }), env, 'demo')
    expect(allowed.headers.get('Cache-Control')).toBe('no-store')
  })
  test('写入 API 直接返回服务端保存结果，无需再读详情', async () => {
    const env = { PASSWORD: 'test-password', SUB: namespace() }
    const token = await createSession(env)
    const req = request(JSON.stringify(input()), { Cookie: `${SESSION_COOKIE}=${token}` })
    const response = await handleApi(req, env, new URL(req.url))
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.sub?.name).toBe(input().name)
    expect(data.sub?.content).toBeUndefined() // Do not echo up to 24 MB back to the editor.
    expect(data.sub?.sha256).toHaveLength(64)
  })
})

test('会话签名防篡改、支持过期和密码轮换', async () => {
  const env = { PASSWORD: 'test-password' }
  const token = await createSession(env)
  expect(await verifySession(env, token)).toBe(true)
  expect(await verifySession(env, `${token.slice(0, -2)}aa`)).toBe(false)
  expect(await verifySession(env, await createSession(env, -1))).toBe(false)
  expect(await verifySession({ PASSWORD: 'other-password' }, token)).toBe(false)
})

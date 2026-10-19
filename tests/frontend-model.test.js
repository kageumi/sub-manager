import { describe, expect, test } from 'bun:test'
import {
  draftFromSubscription,
  emptyDraft,
  matchesSearch,
  payloadFromDraft,
  publicUrlFor,
  validateDraft,
  selectSubscriptions,
  defaultListView,
} from '../frontend/src/subscriptions/model.js'

const valid = () => ({ ...emptyDraft(), id: 'clash-main', name: '我的配置', content: 'proxies: []\n' })

describe('前端与订阅 API 的数据边界', () => {
  test('拒绝系统保留 ID，避免与登录及资源路由冲突', () => {
    for (const id of ['api', 'API', 'assets', 'login', '_health'])
      expect(validateDraft({ ...valid(), id }).id).toBeDefined()
    expect(validateDraft({ ...valid(), id: 'valid.id_2026-1' })).toEqual({})
  })
  test('按 UTF-8 字节限制内容，中文不能绕过 24 MB 上限', () => {
    expect(validateDraft({ ...valid(), content: '订'.repeat(8 * 1024 * 1024 + 1) }).content).toBeDefined()
  })
  test('无效访问规则必须报错，不能静默变成不受限制的订阅', () => {
    expect(validateDraft({ ...valid(), allowedCountries: 'China' }).allowedCountries).toBeDefined()
    expect(validateDraft({ ...valid(), allowedDomains: 'example.com, invalid' }).allowedDomains).toBeDefined()
    expect(
      validateDraft({ ...valid(), allowedCountries: 'CN，US', allowedDomains: '*.example.com' }),
    ).toEqual({})
  })
  test('中文分隔符、URL 和地区大小写可被规范化', () => {
    const payload = payloadFromDraft({
      ...valid(),
      allowedCountries: 'cn，US；cn',
      allowedDomains: 'https://EXAMPLE.com/path, *.Example.net',
    })
    expect(payload.allowedCountries).toEqual(['CN', 'US'])
    expect(payload.allowedDomains).toEqual(['example.com', '*.example.net'])
  })
  test('读取后再提交保留所有客户端响应设置与原始内容', () => {
    const sub = {
      id: 'clash',
      name: 'Clash',
      content: 'proxies: []\n\n',
      contentType: 'text/yaml; charset=utf-8',
      filename: 'config.yaml',
      allowedCountries: ['CN', 'US'],
      allowedDomains: ['example.com', '*.example.net'],
      subscriptionUserinfo: 'upload=0; download=1; total=20; expire=0',
    }
    expect(payloadFromDraft(draftFromSubscription(sub))).toEqual(sub)
  })
  test('通配域名不会被错误变成不被允许的根域名', () => {
    expect(publicUrlFor({ id: 'clash', allowedDomains: ['*.example.com'] }, 'https://sub.example.com')).toBe(
      'https://sub.example.com/clash',
    )
    expect(
      publicUrlFor(
        { id: 'clash', allowedDomains: ['*.example.com', 'config.example.net'] },
        'https://admin.example.org',
      ),
    ).toBe('https://config.example.net/clash')
  })
  test('搜索同时匹配名称、ID、地区与域名', () => {
    const sub = {
      id: 'clash-main',
      name: '日常配置',
      allowedCountries: ['CN'],
      allowedDomains: ['config.example.com'],
    }
    for (const query of ['日常', 'CLASH', ' cn ', 'example.com']) expect(matchesSearch(sub, query)).toBe(true)
    expect(matchesSearch(sub, 'not-found')).toBe(false)
  })
})

test('列表筛选、排序与越界分页只生成视图，不修改原始集合', () => {
  const items = Array.from({ length: 13 }, (_, index) => ({
    id: `id-${index}`,
    name: `配置 ${index}`,
    updatedAt: index,
    allowedCountries: index === 2 ? ['CN'] : [],
    allowedDomains: [],
  }))
  const original = items.map((item) => item.id)
  const page = selectSubscriptions(items, { ...defaultListView, page: 99 })
  expect(page.page).toBe(2)
  expect(page.items).toHaveLength(3)
  const restricted = selectSubscriptions(items, { ...defaultListView, filter: 'restricted' })
  expect(restricted.total).toBe(1)
  expect(restricted.items[0].id).toBe('id-2')
  expect(selectSubscriptions(items, { ...defaultListView, query: 'missing' }).pages).toBe(1)
  expect(items.map((item) => item.id)).toEqual(original)
})

import { afterEach, describe, expect, test } from 'bun:test'
import { requestJson, setUnauthorizedHandler } from '../frontend/src/shared/api.js'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
  setUnauthorizedHandler(null)
})

describe('API 失败与会话恢复', () => {
  test('密码错误与会话过期分开提示，不触发管理端会话处理', async () => {
    let expired = false
    setUnauthorizedHandler(() => {
      expired = true
    })
    globalThis.fetch = async () => new Response(JSON.stringify({ error: '密码错误' }), { status: 401 })
    await expect(
      requestJson('/api/login', { method: 'POST', body: { password: 'incorrect' } }),
    ).rejects.toThrow('密码错误')
    expect(expired).toBe(false)
  })
  test('401 触发会话退出，不继续返回管理数据', async () => {
    let expired = false
    setUnauthorizedHandler(() => {
      expired = true
    })
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    await expect(requestJson('/api/subs')).rejects.toThrow('登录状态已失效')
    expect(expired).toBe(true)
  })
  test('保留服务器校验错误供用户处理', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: '订阅 ID 已存在，请更换一个' }), { status: 409 })
    await expect(requestJson('/api/subs')).rejects.toThrow('订阅 ID 已存在')
  })
  test('网络失败给出可操作的提示', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(requestJson('/api/subs')).rejects.toThrow('网络连接失败')
  })
  test('取消请求维持 AbortError，避免显示虚假的网络故障', async () => {
    globalThis.fetch = async () => {
      throw new DOMException('Aborted', 'AbortError')
    }
    try {
      await requestJson('/api/subs')
      throw new Error('Expected abort')
    } catch (err) {
      expect(err.name).toBe('AbortError')
    }
  })
  test('读取响应体时取消仍保留 AbortError，不伪装成无效数据', async () => {
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new DOMException('Aborted', 'AbortError')
      },
    })
    await expect(requestJson('/api/subs')).rejects.toHaveProperty('name', 'AbortError')
  })
  test('已取消的过时 401 不触发会话退出', async () => {
    const controller = new AbortController()
    let expired = false
    setUnauthorizedHandler(() => {
      expired = true
    })
    globalThis.fetch = async () => {
      controller.abort()
      return new Response('{}', { status: 401 })
    }
    await expect(requestJson('/api/subs', { signal: controller.signal })).rejects.toHaveProperty(
      'name',
      'AbortError',
    )
    expect(expired).toBe(false)
  })
  test('HTTP 成功但返回 HTML 不能伪装成保存成功', async () => {
    globalThis.fetch = async () => new Response('<html>error</html>')
    await expect(requestJson('/api/subs')).rejects.toThrow('无效数据')
  })
})

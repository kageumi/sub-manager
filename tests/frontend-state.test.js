import { afterEach, beforeAll, expect, test } from 'bun:test'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost:8787/' })
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MutationObserver',
])
  globalThis[key] = dom[key]
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let renderHook, cleanup, act, useSubscriptions, useSubscriptionEditor
beforeAll(async () => {
  ;({ renderHook, cleanup, act } = await import('@testing-library/react/pure'))
  ;({ useSubscriptions } = await import('../frontend/src/subscriptions/useSubscriptions.js'))
  ;({ useSubscriptionEditor } = await import('../frontend/src/subscriptions/useSubscriptionEditor.js'))
})
const originalFetch = globalThis.fetch
afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})
const fixture = {
  id: 'new',
  name: '名称',
  content: '{"a":1}',
  allowedCountries: [],
  allowedDomains: [],
  size: 7,
}
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status })
const fakeFetch = (url) =>
  Promise.resolve(reply(url === '/api/subs' ? { subs: [fixture] } : { sub: fixture }))
function useWorkspace() {
  const collection = useSubscriptions()
  const editor = useSubscriptionEditor(collection.save)
  return { collection, editor }
}
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}
async function fill(result, id = 'draft') {
  await act(async () => {
    result.current.editor.change('id', id)
    result.current.editor.change('name', '草稿')
    result.current.editor.change('content', 'config')
  })
}

test('保存失败保留草稿，同步锁防止重复保存', async () => {
  let finish,
    writes = 0
  globalThis.fetch = (url, options) =>
    options?.method === 'POST'
      ? (writes++,
        new Promise((resolve) => {
          finish = resolve
        }))
      : fakeFetch(url)
  const { result } = renderHook(useWorkspace)
  await flush()
  await fill(result)
  let saving
  await act(async () => {
    saving = result.current.editor.save()
    result.current.editor.save()
  })
  expect(writes).toBe(1)
  await act(async () => {
    finish(reply({ error: '冲突' }, 409))
    await saving
  })
  expect(result.current.editor.draft.content).toBe('config')
  expect(result.current.editor.dirty).toBe(true)
  expect(result.current.editor.error).toBe('冲突')
  expect(result.current.editor.busy).toBe(false)
})

test('迟到的详情不覆盖新建草稿', async () => {
  let finish
  globalThis.fetch = (url) =>
    url.endsWith('/old')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : fakeFetch(url)
  const { result } = renderHook(useWorkspace)
  await flush()
  let opening
  await act(async () => {
    opening = result.current.editor.open('old')
    result.current.editor.open()
  })
  await fill(result)
  await act(async () => {
    finish(reply({ sub: { ...fixture, id: 'old' } }))
    await opening
  })
  expect(result.current.editor.current).toBe(null)
  expect(result.current.editor.draft.id).toBe('draft')
})

test('保存直接更新集合，继续编辑不重读详情，保存期间禁止编辑', async () => {
  const calls = []
  let finish
  globalThis.fetch = (url, options) => {
    calls.push([url, options?.method ?? 'GET'])
    return options?.method === 'POST'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : fakeFetch(url)
  }
  const { result } = renderHook(useWorkspace)
  await flush()
  await fill(result, 'saved')
  let saving
  await act(async () => {
    saving = result.current.editor.save()
    result.current.editor.change('content', '迟到的修改')
  })
  expect(result.current.editor.draft.content).toBe('config')
  await act(async () => {
    finish(reply({ ok: true, sub: { id: 'saved', name: '草稿', size: 6, updatedAt: 123, sha256: 'hash' } }))
    await saving
  })
  await act(async () => {
    await result.current.editor.open('saved')
  })
  expect(result.current.editor.dirty).toBe(false)
  expect(result.current.editor.current.updatedAt).toBe(123)
  expect(result.current.collection.items.find((sub) => sub.id === 'saved').sha256).toBe('hash')
  expect(result.current.collection.items.find((sub) => sub.id === 'saved').content).toBeUndefined()
  expect(calls).toEqual([
    ['/api/subs', 'GET'],
    ['/api/subs', 'POST'],
  ])
})

test('取消详情请求后丢弃响应', async () => {
  let finish
  globalThis.fetch = (url) =>
    url.endsWith('/old')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : fakeFetch(url)
  const { result } = renderHook(useWorkspace)
  await flush()
  let opening
  await act(async () => {
    opening = result.current.editor.open('old')
    result.current.editor.cancel()
  })
  await act(async () => {
    finish(reply({ sub: { ...fixture, id: 'old' } }))
    await opening
  })
  expect(result.current.editor.current).toBe(null)
})

test('删除失败保留集合，成功后不重新读取列表', async () => {
  let deletes = 0,
    reads = 0
  globalThis.fetch = (url, options) => {
    if (options?.method === 'DELETE')
      return Promise.resolve(++deletes === 1 ? reply({ error: '暂时不可用' }, 503) : reply({ ok: true }))
    reads++
    return fakeFetch(url)
  }
  const { result } = renderHook(useWorkspace)
  await flush()
  await act(async () => {
    await expect(result.current.collection.remove('new')).rejects.toThrow('暂时不可用')
  })
  expect(result.current.collection.items).toHaveLength(1)
  await act(async () => {
    await result.current.collection.remove('new')
  })
  expect(result.current.collection.items).toHaveLength(0)
  expect(reads).toBe(1)
})

test('撤销恢复保存基线，未完成的文件导入不能覆盖撤销结果', async () => {
  globalThis.fetch = fakeFetch
  const { result } = renderHook(useWorkspace)
  await flush()
  await act(async () => {
    await result.current.editor.open('new')
  })
  let finish, importing
  await act(async () => {
    importing = result.current.editor.importFile({
      size: 3,
      text: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
  })
  await act(async () => {
    result.current.editor.change('name', '修改')
    result.current.editor.reset()
  })
  await act(async () => {
    finish('new')
    await importing
  })
  expect(result.current.editor.draft.name).toBe(fixture.name)
  expect(result.current.editor.draft.content).toBe(fixture.content)
  expect(result.current.editor.dirty).toBe(false)
})

test('读取文件期间的手动编辑不会被覆盖', async () => {
  globalThis.fetch = fakeFetch
  const { result } = renderHook(useWorkspace)
  await flush()
  await fill(result)
  let finish, importing
  await act(async () => {
    importing = result.current.editor.importFile({
      size: 3,
      text: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    result.current.editor.change('content', '手动修改')
  })
  await act(async () => {
    finish('new')
    await expect(importing).rejects.toThrow('配置已修改')
  })
  expect(result.current.editor.draft.content).toBe('手动修改')
})

test('校验失败不发送请求；保存响应缺少元数据不应清除草稿', async () => {
  let writes = 0
  globalThis.fetch = (url, options) =>
    options?.method === 'POST' ? (writes++, Promise.resolve(reply({ ok: true }))) : fakeFetch(url)
  const { result } = renderHook(useWorkspace)
  await flush()
  await act(async () => {
    expect(await result.current.editor.save()).toBe(false)
  })
  expect(result.current.editor.errors.name).toBeDefined()
  expect(writes).toBe(0)
  await fill(result)
  await act(async () => {
    expect(await result.current.editor.save()).toBe(false)
  })
  expect(result.current.editor.dirty).toBe(true)
  expect(result.current.editor.error).toContain('数据不完整')
})

test('编辑页卸载后，迟到的保存结果不再触发页面后续操作', async () => {
  let finish
  globalThis.fetch = (url, options) =>
    options?.method === 'POST'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : fakeFetch(url)
  const { result, unmount } = renderHook(useWorkspace)
  await flush()
  await fill(result)
  let saving
  await act(async () => {
    saving = result.current.editor.save()
  })
  unmount()
  finish(reply({ ok: true, sub: { id: 'draft', name: '草稿' } }))
  expect(await saving).toBe(false)
})

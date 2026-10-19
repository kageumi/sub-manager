import { afterEach, beforeAll, expect, test } from 'bun:test'
import { useCallback, useState } from 'react'
import { Window } from 'happy-dom'

let render, cleanup, act, fireEvent, within, NavigationGuard, useEditorGuard, useNavigation
const dom = new Window({ url: 'http://localhost/' })
beforeAll(async () => {
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MutationObserver',
    'ResizeObserver',
    'HTMLButtonElement',
    'DocumentFragment',
  ])
    globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.requestAnimationFrame = dom.requestAnimationFrame.bind(dom)
  globalThis.cancelAnimationFrame = dom.cancelAnimationFrame.bind(dom)
  globalThis.getComputedStyle = dom.getComputedStyle.bind(dom)
  ;({ render, cleanup, act, fireEvent, within } = await import('@testing-library/react/pure'))
  ;({ NavigationGuard, useEditorGuard, useNavigation } =
    await import('../frontend/src/app/NavigationGuard.jsx'))
})
afterEach(() => cleanup())

function Editor({ fail = false, onBack }) {
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const save = useCallback(async () => {
    setBusy(true)
    await Promise.resolve()
    if (!fail) setDirty(false)
    setBusy(false)
    return !fail
  }, [fail])
  useEditorGuard({ dirty, busy, save })
  return (
    <>
      <button onClick={() => setDirty(true)}>修改</button>
      <button onClick={onBack}>返回</button>
      <span>{dirty ? '草稿' : '已保存'}</span>
    </>
  )
}
function Screen({ fail }) {
  const [editing, setEditing] = useState(true)
  const guard = useNavigation()
  if (editing) return <Editor fail={fail} onBack={() => guard.request(() => setEditing(false))} />
  return (
    <>
      <h1>列表</h1>
      <button onClick={() => guard.request(() => setEditing(true))}>编辑</button>
    </>
  )
}
function setup(fail = false) {
  render(
    <NavigationGuard active busy={false}>
      <Screen fail={fail} />
    </NavigationGuard>,
  )
}
async function click(name) {
  await act(async () => fireEvent.click(within(document.body).getByRole('button', { name, exact: true })))
}

test('单地址工作区内保存、返回、再次编辑和放弃均不改变 URL 或历史记录', async () => {
  const url = window.location.href
  const history = window.history.length
  setup()
  await click('修改')
  await click('返回')
  expect(within(document.body).getByRole('alertdialog')).toBeDefined()
  await click('保存并离开')
  expect(within(document.body).getByRole('heading', { name: '列表' })).toBeDefined()
  await click('编辑')
  await click('修改')
  await click('返回')
  await click('不保存')
  expect(within(document.body).getByRole('heading', { name: '列表' })).toBeDefined()
  expect(window.location.href).toBe(url)
  expect(window.history.length).toBe(history)
})

test('保存失败取消离开并保留草稿；继续编辑保持当前界面', async () => {
  setup(true)
  await click('修改')
  await click('返回')
  await click('保存并离开')
  expect(within(document.body).getByText('草稿')).toBeDefined()
  await click('返回')
  await click('继续编辑')
  expect(within(document.body).getByText('草稿')).toBeDefined()
  expect(within(document.body).queryByRole('heading', { name: '列表' })).toBeNull()
})

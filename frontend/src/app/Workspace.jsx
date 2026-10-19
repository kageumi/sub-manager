import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { LogOutIcon, SquareTerminalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSubscriptions } from '../subscriptions/useSubscriptions.js'
import { defaultListView, publicUrlFor } from '../subscriptions/model.js'
import { NavigationGuard, useNavigation } from './NavigationGuard.jsx'
import { preloadEditor } from './preload.js'
import { AppearanceMenu } from '../shared/menus.jsx'
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx'
import { useNotify } from '../shared/Providers.jsx'
import { requestJson } from '../shared/api.js'
import { useMediaQuery } from '../shared/useMediaQuery.js'

const WorkspaceContext = createContext(null)
export const useWorkspace = () => useContext(WorkspaceContext)
const SubscriptionsPage = lazy(() =>
  import('../pages/SubscriptionsPage.jsx').then((module) => ({ default: module.SubscriptionsPage })),
)
const SubscriptionPage = lazy(() =>
  import('../pages/SubscriptionPage.jsx').then((module) => ({ default: module.SubscriptionPage })),
)

function Header({ onLogout, onList, setLoggingOut }) {
  const compact = useMediaQuery('(max-width: 639px)')
  const guard = useNavigation()
  const notify = useNotify()
  async function logout() {
    setLoggingOut(true)
    try {
      await requestJson('/api/logout', { method: 'POST' })
      onLogout()
    } catch (err) {
      notify(err.message, true)
    } finally {
      setLoggingOut(false)
    }
  }
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Button variant="ghost" disabled={guard.busy} onClick={onList} aria-label="订阅列表">
          <SquareTerminalIcon data-icon="inline-start" />
          订阅管理
        </Button>
        <div className="flex items-center gap-2">
          <AppearanceMenu />
          <Button
            variant="ghost"
            size={compact ? 'icon' : 'default'}
            disabled={guard.busy}
            onClick={() => guard.request(logout)}
            aria-label="退出登录"
          >
            <LogOutIcon data-icon="inline-start" />
            <span className="hidden sm:inline">退出</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function Workspace({ active, onLogout }) {
  const collection = useSubscriptions()
  const [loggingOut, setLoggingOut] = useState(false)
  return (
    <NavigationGuard active={active} busy={collection.writing || loggingOut}>
      <WorkspaceContent
        active={active}
        onLogout={onLogout}
        collection={collection}
        setLoggingOut={setLoggingOut}
      />
    </NavigationGuard>
  )
}

function WorkspaceContent({ active, onLogout, collection, setLoggingOut }) {
  const guard = useNavigation()
  const notify = useNotify()
  const [view, setView] = useState(defaultListView)
  const [selection, setSelection] = useState(null)
  const scroll = useRef(0)
  const [deletion, setDeletion] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const previouslyActive = useRef(active)
  useEffect(() => {
    if (active && !previouslyActive.current) collection.refresh()
    previouslyActive.current = active
  }, [active, collection.refresh])
  useEffect(() => {
    preloadEditor()
  }, [])
  useEffect(
    () => () => {
      document.title = '订阅管理'
    },
    [],
  )
  async function copy(sub) {
    try {
      await navigator.clipboard.writeText(publicUrlFor(sub, window.location.origin))
      notify('链接已复制')
    } catch {
      notify('复制失败，请手动复制订阅链接', true)
    }
  }
  async function remove() {
    if (deleting) return
    setDeleting(true)
    try {
      await collection.remove(deletion.id)
      setDeletion(null)
      if (selection) setSelection(null)
      notify('订阅已删除')
    } catch (err) {
      notify(`删除失败：${err.message}`, true)
    } finally {
      setDeleting(false)
    }
  }
  function openList() {
    if (selection) guard.request(() => setSelection(null))
  }
  function openEditor(id = null) {
    guard.request(() => setSelection({ id }))
  }
  return (
    <WorkspaceContext.Provider
      value={{
        collection,
        active,
        view,
        scroll,
        openEditor,
        updateView: (patch) => setView((previous) => ({ ...previous, page: 1, ...patch })),
        copy,
        requestDelete: (sub, returnFocusTo) => setDeletion({ ...sub, returnFocusTo }),
      }}
    >
      <>
        <div className="min-h-dvh bg-page">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3"
            onClick={(event) => {
              event.preventDefault()
              document.getElementById('main-content')?.focus()
            }}
          >
            跳至主要内容
          </a>
          <Header onLogout={onLogout} onList={openList} setLoggingOut={setLoggingOut} />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-7xl px-4 py-8 outline-none sm:px-8 sm:py-10"
          >
            <Suspense
              fallback={
                <div
                  className="flex min-h-64 items-center justify-center"
                  role="status"
                  aria-label="正在加载页面"
                >
                  <Spinner />
                </div>
              }
            >
              {selection ? <SubscriptionPage id={selection.id} onBack={openList} /> : <SubscriptionsPage />}
            </Suspense>
          </main>
        </div>
        {active && deletion && (
          <ConfirmDialog
            title="删除订阅？"
            returnFocusTo={deletion.returnFocusTo}
            confirmLabel="确认删除"
            danger
            busy={deleting}
            onCancel={() => setDeletion(null)}
            onConfirm={remove}
          >
            {deletion.name}，删除后无法恢复。
          </ConfirmDialog>
        )}
      </>
    </WorkspaceContext.Provider>
  )
}

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, LogOutIcon, RotateCcwIcon, SaveIcon, SquareTerminalIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSubscriptionEditor } from '../subscriptions/useSubscriptionEditor.js'
import { useSubscriptions } from '../subscriptions/useSubscriptions.js'
import { defaultListView, publicUrlFor } from '../subscriptions/model.js'
import { NavigationGuard, useEditorGuard, useNavigation } from './NavigationGuard.jsx'
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

function Header({ onLogout, onList, setLoggingOut, editor, mode, onSave, onUndo, disabled }) {
  const compact = useMediaQuery('(max-width: 639px)')
  const guard = useNavigation()
  const notify = useNotify()
  const editing = Boolean(editor)
  const status = !editor
    ? ''
    : editor.status === 'loading'
      ? '加载中'
      : editor.status === 'load-error'
        ? '读取失败'
        : editor.busy
          ? '保存中'
          : editor.dirty
            ? '未保存'
            : editor.current
              ? '已保存'
              : '草稿'
  const statusVariant =
    editor?.status === 'load-error' ? 'destructive' : editor?.dirty ? 'secondary' : 'outline'
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
    <header className="sticky top-0 z-20 border-b border-border/60 bg-page/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                disabled={guard.busy}
                aria-label="返回列表"
                onClick={onList}
              >
                <ArrowLeftIcon />
              </Button>
              <h1 id="editor-title" className="truncate text-sm font-semibold tracking-tight">
                {mode === 'edit' ? '编辑订阅' : '新建订阅'}
              </h1>
              <span role="status" className="ml-1 hidden sm:block">
                <Badge variant={statusVariant}>{status}</Badge>
              </span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <SquareTerminalIcon className="size-4" aria-hidden="true" />
              </span>
              <span>订阅管理</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing && (
            <>
              <Button
                type="button"
                variant="ghost"
                size={compact ? 'icon' : 'default'}
                disabled={disabled || !editor.dirty}
                aria-label="撤销修改"
                onClick={onUndo}
              >
                <RotateCcwIcon data-icon="inline-start" />
                <span className="hidden sm:inline">撤销</span>
              </Button>
              <Button
                type="button"
                disabled={disabled || (Boolean(editor.current) && !editor.dirty)}
                aria-busy={editor.busy}
                onClick={onSave}
              >
                {editor.busy ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                {mode === 'create' ? '创建' : '保存'}
              </Button>
            </>
          )}
          <div
            className={editing ? 'ml-1 hidden items-center gap-1 lg:flex' : 'ml-1 flex items-center gap-1'}
          >
            <AppearanceMenu />
            <Button
              variant="ghost"
              size={compact ? 'icon' : 'default'}
              disabled={guard.busy}
              aria-label="退出登录"
              onClick={() => guard.request(logout)}
            >
              <LogOutIcon data-icon="inline-start" />
              <span className="hidden sm:inline">退出</span>
            </Button>
          </div>
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
  const [deletion, setDeletion] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const scroll = useRef(0)
  const editor = useSubscriptionEditor(collection.save)
  const { open: openDraft, save: saveDraft, reset: resetDraft } = editor
  const previouslyActive = useRef(active)

  useEffect(() => {
    if (!selection) {
      openDraft(null)
      setResetting(false)
      return
    }
    openDraft(selection.id)
    window.scrollTo(0, 0)
  }, [selection, openDraft])
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
  const save = useCallback(async () => {
    const result = await saveDraft()
    if (result) notify('已保存')
    return result
  }, [saveDraft, notify])
  useEditorGuard({ dirty: editor.dirty, busy: editor.busy, save })

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
  const mode = selection?.id || editor.current ? 'edit' : 'create'
  const editorDisabled = editor.status !== 'ready' || collection.writing
  return (
    <WorkspaceContext.Provider
      value={{
        collection,
        active,
        editor,
        save,
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
          <Header
            onLogout={onLogout}
            onList={openList}
            setLoggingOut={setLoggingOut}
            editor={selection ? editor : null}
            mode={mode}
            onSave={save}
            onUndo={() => setResetting(true)}
            disabled={editorDisabled}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl px-4 py-6 outline-none sm:px-6 sm:py-8"
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
              {selection ? <SubscriptionPage id={selection.id} /> : <SubscriptionsPage />}
            </Suspense>
          </main>
        </div>
        {active && selection && resetting && (
          <ConfirmDialog
            title="撤销全部未保存的修改？"
            confirmLabel="确认撤销"
            onCancel={() => setResetting(false)}
            onConfirm={() => {
              resetDraft()
              setResetting(false)
            }}
          >
            恢复到上次保存的内容。
          </ConfirmDialog>
        )}
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

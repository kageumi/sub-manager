import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  CopyIcon,
  DownloadIcon,
  UploadIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  BracesIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useWorkspace } from '../app/Workspace.jsx'
import { useEditorGuard } from '../app/NavigationGuard.jsx'
import { useSubscriptionEditor } from '../subscriptions/useSubscriptionEditor.js'
import { SubscriptionField, fieldId } from '../subscriptions/SubscriptionField.jsx'
import { publicUrlFor } from '../subscriptions/model.js'
import { byteLength } from '../../../shared/subscription.js'
import { useNotify } from '../shared/Providers.jsx'
import { useSaveShortcut } from '../shared/useSaveShortcut.js'
import { formatBytes, formatDate } from '../shared/format.js'
import { downloadText } from '../shared/download.js'
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx'
import { useMediaQuery } from '../shared/useMediaQuery.js'

export function SubscriptionPage({ id, onBack }) {
  const compact = useMediaQuery('(max-width: 639px)')
  const { collection, active, copy, requestDelete } = useWorkspace()
  const editor = useSubscriptionEditor(collection.save)
  const mode = id || editor.current ? 'edit' : 'create'
  const notify = useNotify()
  const [tab, setTab] = useState('access')
  const [resetting, setResetting] = useState(false)
  const file = useRef(null)
  const validationFocus = useRef(null)
  const { open, cancel } = editor
  useEffect(() => {
    document.title = `${mode === 'edit' ? '编辑订阅' : '新建订阅'} · 订阅管理`
  }, [mode])
  useEffect(() => {
    open(id)
    window.scrollTo(0, 0)
    return cancel
  }, [id, open, cancel])
  const save = useCallback(async () => {
    if (!active) return false
    const result = await editor.save()
    if (result) notify('已保存')
    return result
  }, [active, editor.save, notify])
  useEditorGuard({ dirty: editor.dirty, busy: editor.busy, save })
  useEffect(() => {
    const key = Object.keys(editor.errors).find((key) => editor.errors[key])
    if (!key) return
    validationFocus.current = key
    if (['contentType', 'filename', 'subscriptionUserinfo'].includes(key)) setTab('response')
    else if (['allowedCountries', 'allowedDomains'].includes(key)) setTab('access')
  }, [editor.validation])
  useEffect(() => {
    if (!validationFocus.current) return
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(fieldId(validationFocus.current))
      if (!element || element.closest('[role="tabpanel"]')?.hidden) return
      element.focus({ preventScroll: true })
      element.scrollIntoView({ block: 'center' })
      validationFocus.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [editor.validation, tab])
  async function submit(event) {
    event?.preventDefault()
    await save()
  }
  useSaveShortcut(submit, active)
  const content = editor.draft.content
  const largeContent = content.length >= 100_000
  const [largeContentSize, setLargeContentSize] = useState(0)
  useEffect(() => {
    // Encoding a large draft on every keystroke is costly; wait until typing pauses.
    if (!largeContent) return
    const timer = setTimeout(() => setLargeContentSize(byteLength(content)), 200)
    return () => clearTimeout(timer)
  }, [content, largeContent])
  const contentSize = largeContent ? largeContentSize : byteLength(content)
  async function importFile(event) {
    const imported = event.target.files?.[0]
    event.target.value = ''
    if (!imported) return
    try {
      if (await editor.importFile(imported)) notify('已导入')
    } catch (err) {
      notify(err.message || '无法读取文件', true)
    }
  }
  function format() {
    try {
      editor.change('content', JSON.stringify(JSON.parse(editor.draft.content), null, 2))
    } catch {
      notify('内容不是有效的 JSON', true)
    }
  }
  function download() {
    const draft = editor.draft
    const extension = /^\s*[[{]/.test(draft.content) ? 'json' : 'yaml'
    downloadText(
      draft.content,
      draft.filename.trim() || `${draft.id.trim() || 'subscription'}.${extension}`,
      draft.contentType || 'text/plain;charset=utf-8',
    )
  }
  const disabled = editor.status !== 'ready' || collection.writing
  return (
    <form onSubmit={submit} noValidate aria-labelledby="editor-title" className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-border/70 bg-page px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" disabled={editor.busy} aria-label="返回列表" onClick={onBack}>
            <ArrowLeftIcon />
          </Button>
          <h1 id="editor-title" className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {mode === 'edit' ? '编辑订阅' : '新建订阅'}
          </h1>
          <span role="status" className="hidden sm:block">
            <Badge variant={editor.dirty ? 'secondary' : 'outline'}>
              {editor.busy ? '保存中' : editor.dirty ? '未保存' : editor.current ? '已保存' : '草稿'}
            </Badge>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size={compact ? 'icon' : 'default'}
            disabled={disabled || !editor.dirty}
            onClick={() => setResetting(true)}
            aria-label="撤销修改"
          >
            <RotateCcwIcon data-icon="inline-start" />
            <span className="hidden sm:inline">撤销修改</span>
          </Button>
          <Button
            type="submit"
            disabled={disabled || (Boolean(editor.current) && !editor.dirty)}
            aria-busy={editor.busy}
          >
            {editor.busy ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            {mode === 'create' ? '创建订阅' : '保存修改'}
          </Button>
        </div>
      </div>
      {editor.error && (
        <Alert variant="destructive">
          <AlertTitle>{editor.status === 'load-error' ? '无法读取订阅' : '保存失败'}</AlertTitle>
          <AlertDescription>{editor.error}</AlertDescription>
          {editor.status === 'load-error' && (
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => open(id)}>
              重新加载
            </Button>
          )}
        </Alert>
      )}
      {editor.status === 'loading' ? (
        <div role="status" aria-label="正在加载订阅" className="flex flex-col gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        editor.status !== 'load-error' && (
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>基本信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="grid gap-5 sm:grid-cols-2">
                    <SubscriptionField
                      editor={editor}
                      name="name"
                      label="订阅名称"
                      maxLength={100}
                      aria-required
                    />
                    <SubscriptionField
                      editor={editor}
                      name="id"
                      label="订阅 ID"
                      readOnly={Boolean(editor.current)}
                      spellCheck={false}
                      autoCapitalize="none"
                      aria-required
                    />
                  </FieldGroup>
                </CardContent>
                {editor.current && (
                  <CardFooter>
                    <span className="text-xs text-muted-foreground">
                      更新于 {formatDate(editor.current.updatedAt)}
                    </span>
                  </CardFooter>
                )}
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>配置内容</CardTitle>
                  <CardDescription>{formatBytes(contentSize)}</CardDescription>
                  <CardAction>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => file.current?.click()}
                    >
                      <UploadIcon data-icon="inline-start" />
                      导入
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <SubscriptionField
                    editor={editor}
                    name="content"
                    label={<span className="sr-only">配置内容</span>}
                    multiline
                    spellCheck={false}
                    aria-required
                    rows={20}
                    className="min-h-96 field-sizing-fixed resize-y"
                  />
                  <input
                    ref={file}
                    type="file"
                    hidden
                    disabled={disabled}
                    aria-label="导入配置文件"
                    accept=".yaml,.yml,.json,.txt,.conf,text/*,application/json"
                    onChange={importFile}
                  />
                </CardContent>
                <CardFooter className="justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled || !editor.draft.content}
                    onClick={format}
                  >
                    <BracesIcon data-icon="inline-start" />
                    格式化 JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || !editor.draft.content}
                    onClick={download}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    下载
                  </Button>
                </CardFooter>
              </Card>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>可选设置</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={tab} onValueChange={setTab} className="gap-5">
                    <TabsList className="w-full">
                      <TabsTrigger value="access">访问限制</TabsTrigger>
                      <TabsTrigger value="response">客户端响应</TabsTrigger>
                    </TabsList>
                    <TabsContent value="access" keepMounted>
                      <FieldGroup>
                        <SubscriptionField
                          editor={editor}
                          name="allowedCountries"
                          label="允许的地区"
                          spellCheck={false}
                        />
                        <SubscriptionField
                          editor={editor}
                          name="allowedDomains"
                          label="允许的域名"
                          multiline
                          rows={4}
                          spellCheck={false}
                        />
                      </FieldGroup>
                    </TabsContent>
                    <TabsContent value="response" keepMounted>
                      <FieldGroup>
                        <SubscriptionField editor={editor} name="filename" label="下载文件名" />
                        <SubscriptionField
                          editor={editor}
                          name="contentType"
                          label="内容类型"
                          spellCheck={false}
                        />
                        <SubscriptionField
                          editor={editor}
                          name="subscriptionUserinfo"
                          label="流量信息"
                          multiline
                          rows={4}
                          spellCheck={false}
                        />
                      </FieldGroup>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                {editor.current && (
                  <CardFooter>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={disabled}
                      onClick={(event) => requestDelete(editor.current, event.currentTarget)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      删除订阅
                    </Button>
                  </CardFooter>
                )}
              </Card>
              {editor.current && (
                <Card>
                  <CardHeader>
                    <CardTitle>订阅链接</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InputGroup>
                      <InputGroupInput
                        readOnly
                        aria-label="订阅链接"
                        value={publicUrlFor(editor.current, window.location.origin)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          aria-label="复制订阅链接"
                          disabled={disabled}
                          onClick={() => copy(editor.current)}
                        >
                          <CopyIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )
      )}
      {resetting && active && (
        <ConfirmDialog
          title="撤销全部未保存的修改？"
          confirmLabel="确认撤销"
          onCancel={() => setResetting(false)}
          onConfirm={() => {
            editor.reset()
            setResetting(false)
          }}
        >
          恢复到上次保存的内容。
        </ConfirmDialog>
      )}
    </form>
  )
}

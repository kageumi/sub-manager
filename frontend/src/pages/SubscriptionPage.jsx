import { useEffect, useRef, useState } from 'react'
import { BracesIcon, CopyIcon, DownloadIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspace } from '../app/Workspace.jsx'
import { SubscriptionField, fieldId } from '../subscriptions/SubscriptionField.jsx'
import { publicUrlFor } from '../subscriptions/model.js'
import { byteLength } from '../../../shared/subscription.js'
import { useNotify } from '../shared/Providers.jsx'
import { useSaveShortcut } from '../shared/useSaveShortcut.js'
import { formatBytes, formatDate } from '../shared/format.js'
import { downloadText } from '../shared/download.js'
import { useMediaQuery } from '../shared/useMediaQuery.js'

export function SubscriptionPage({ id }) {
  const compact = useMediaQuery('(max-width: 639px)')
  const { collection, active, editor, save, copy, requestDelete } = useWorkspace()
  const mode = id || editor.current ? 'edit' : 'create'
  const notify = useNotify()
  const [tab, setTab] = useState('access')
  const file = useRef(null)
  const validationFocus = useRef(null)
  const { open } = editor
  useEffect(() => {
    document.title = `${mode === 'edit' ? '编辑订阅' : '新建订阅'} · 订阅管理`
  }, [mode])
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
                  {editor.current && (
                    <CardDescription>更新于 {formatDate(editor.current.updatedAt)}</CardDescription>
                  )}
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
                      className="font-mono"
                      aria-required
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>配置内容</CardTitle>
                  <CardDescription>{formatBytes(contentSize)}</CardDescription>
                  <CardAction>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size={compact ? 'icon-sm' : 'sm'}
                        disabled={disabled || !content}
                        aria-label="格式化 JSON"
                        onClick={format}
                      >
                        <BracesIcon data-icon={compact ? undefined : 'inline-start'} />
                        {!compact && '格式化'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size={compact ? 'icon-sm' : 'sm'}
                        disabled={disabled || !content}
                        aria-label="下载配置"
                        onClick={download}
                      >
                        <DownloadIcon data-icon={compact ? undefined : 'inline-start'} />
                        {!compact && '下载'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size={compact ? 'icon-sm' : 'sm'}
                        disabled={disabled}
                        aria-label="导入配置"
                        onClick={() => file.current?.click()}
                      >
                        <UploadIcon data-icon={compact ? undefined : 'inline-start'} />
                        {!compact && '导入'}
                      </Button>
                    </div>
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
                    className="min-h-96 field-sizing-fixed resize-y font-mono leading-relaxed"
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
              </Card>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>访问与响应</CardTitle>
                  {editor.current && (
                    <CardAction>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label="删除订阅"
                        onClick={(event) => requestDelete(editor.current, event.currentTarget)}
                      >
                        <Trash2Icon />
                      </Button>
                    </CardAction>
                  )}
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
                          className="font-mono"
                        />
                        <SubscriptionField
                          editor={editor}
                          name="allowedDomains"
                          label="允许的域名"
                          multiline
                          rows={4}
                          spellCheck={false}
                          className="font-mono"
                        />
                      </FieldGroup>
                    </TabsContent>
                    <TabsContent value="response" keepMounted>
                      <FieldGroup>
                        <SubscriptionField
                          editor={editor}
                          name="filename"
                          label="下载文件名"
                          className="font-mono"
                        />
                        <SubscriptionField
                          editor={editor}
                          name="contentType"
                          label="内容类型"
                          spellCheck={false}
                          className="font-mono"
                        />
                        <SubscriptionField
                          editor={editor}
                          name="subscriptionUserinfo"
                          label="流量信息"
                          multiline
                          rows={4}
                          spellCheck={false}
                          className="font-mono"
                        />
                      </FieldGroup>
                    </TabsContent>
                  </Tabs>
                </CardContent>
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
                        className="font-mono"
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
    </form>
  )
}

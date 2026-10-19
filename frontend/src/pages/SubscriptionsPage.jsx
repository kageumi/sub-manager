import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileCodeIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from '@/components/ui/empty'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableHeader, TableBody, TableHead, TableCell, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useWorkspace } from '../app/Workspace.jsx'
import { useNavigation } from '../app/NavigationGuard.jsx'
import { selectSubscriptions, isRestricted } from '../subscriptions/model.js'
import { formatDate, formatBytes } from '../shared/format.js'
import { useMediaQuery } from '../shared/useMediaQuery.js'

const sorts = [
  { value: 'updated', label: '最近更新' },
  { value: 'name', label: '名称排序' },
]

function SubscriptionActions({ sub, compact = false }) {
  const { copy, requestDelete, openEditor } = useWorkspace()
  const { busy } = useNavigation()
  const opener = useRef(null)
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="outline"
        size={compact ? 'icon-sm' : 'sm'}
        disabled={busy}
        onClick={() => copy(sub)}
        aria-label={`复制 ${sub.name} 的链接`}
      >
        <CopyIcon data-icon="inline-start" />
        <span className="hidden sm:inline">复制</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={opener}
              variant="ghost"
              size={compact ? 'icon-sm' : 'icon'}
              disabled={busy}
              aria-label={`管理 ${sub.name}`}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => openEditor(sub.id)}>
              <PencilIcon />
              编辑
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => requestDelete(sub, opener.current)}>
              <Trash2Icon />
              删除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function accessRules(sub) {
  return [...(sub.allowedCountries ?? []), ...(sub.allowedDomains ?? [])]
}

function AccessBadge({ sub }) {
  const restricted = isRestricted(sub)
  return <Badge variant={restricted ? 'secondary' : 'outline'}>{restricted ? '受限' : '公开'}</Badge>
}

function Access({ sub, wrap = false }) {
  const rules = accessRules(sub)
  return (
    <div className={cn('flex min-w-0 items-center', wrap ? 'flex-wrap gap-x-2 gap-y-1' : 'gap-2')}>
      <AccessBadge sub={sub} />
      {rules.length > 0 && (
        <span className={cn('min-w-0 text-xs text-muted-foreground', wrap ? 'break-words' : 'truncate')}>
          {rules.join(', ')}
        </span>
      )}
    </div>
  )
}

function SubscriptionName({ sub, busy, onOpen, wrap = false }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <Button
        variant="link"
        className={cn('h-auto max-w-full justify-start p-0', wrap && 'text-left')}
        disabled={busy}
        onClick={onOpen}
      >
        <span className={wrap ? 'break-all whitespace-normal' : 'truncate'}>{sub.name}</span>
      </Button>
      <span className="max-w-full truncate font-mono text-xs text-muted-foreground">{sub.id}</span>
    </div>
  )
}

export function SubscriptionsPage() {
  const { collection, view, updateView, scroll, openEditor } = useWorkspace()
  const { busy } = useNavigation()
  const desktop = useMediaQuery('(min-width: 768px)')
  const compact = useMediaQuery('(max-width: 639px)')
  const result = useMemo(() => selectSubscriptions(collection.items, view), [collection.items, view])
  const searching = Boolean(view.query.trim() || view.filter !== 'all')
  useEffect(() => {
    document.title = '订阅列表 · 订阅管理'
  }, [])
  useLayoutEffect(() => {
    window.scrollTo(0, scroll.current)
    const remember = () => {
      scroll.current = window.scrollY
    }
    window.addEventListener('scroll', remember, { passive: true })
    return () => window.removeEventListener('scroll', remember)
  }, [scroll])
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">订阅列表</h1>
          <p className="text-sm text-muted-foreground">共 {collection.items.length} 条订阅</p>
        </div>
        <Button onClick={() => openEditor()} disabled={busy}>
          <PlusIcon data-icon="inline-start" />
          新建订阅
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-xs">
          <InputGroupInput
            placeholder="搜索订阅"
            aria-label="搜索订阅"
            value={view.query}
            onChange={(event) => updateView({ query: event.target.value })}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          {view.query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="清除搜索"
                onClick={() => updateView({ query: '' })}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[view.filter]}
            disabled={busy}
            aria-label="访问范围"
            onValueChange={(value) => {
              if (value[0]) updateView({ filter: value[0] })
            }}
          >
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
            <ToggleGroupItem value="unrestricted">公开</ToggleGroupItem>
            <ToggleGroupItem value="restricted">受限</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <Select
              items={sorts}
              value={view.sort}
              onValueChange={(sort) => {
                if (sort) updateView({ sort })
              }}
              disabled={busy}
            >
              <SelectTrigger aria-label="排序方式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {sorts.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="刷新订阅列表"
              disabled={collection.loading || busy}
              aria-busy={collection.loading}
              onClick={collection.refresh}
            >
              {collection.loading ? <Spinner aria-hidden="true" /> : <RefreshCwIcon />}
            </Button>
          </div>
        </div>
      </div>
      {collection.error && (
        <Alert variant="destructive">
          <AlertTitle>列表加载失败</AlertTitle>
          <AlertDescription>{collection.error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={collection.refresh}>
            重试
          </Button>
        </Alert>
      )}
      {collection.loading && !collection.items.length ? (
        <div
          className="flex flex-col gap-4 rounded-xl border bg-card p-4"
          role="status"
          aria-label="正在加载订阅"
        >
          {[0, 1, 2].map((key) => (
            <div key={key} className="flex items-center justify-between gap-8">
              <div className="flex min-w-0 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ) : result.items.length ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          {desktop ? (
            <Table
              aria-label="订阅列表"
              className="table-fixed [&_td]:px-4 [&_td]:py-3 [&_th]:h-9 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground"
              aria-busy={collection.loading}
            >
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>订阅</TableHead>
                  <TableHead className="w-60">访问</TableHead>
                  <TableHead className="hidden w-24 lg:table-cell">大小</TableHead>
                  <TableHead className="hidden w-32 lg:table-cell">更新时间</TableHead>
                  <TableHead className="w-32">
                    <span className="sr-only">操作</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <SubscriptionName sub={sub} busy={busy} onOpen={() => openEditor(sub.id)} />
                    </TableCell>
                    <TableCell>
                      <Access sub={sub} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatBytes(sub.size)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-muted-foreground">{formatDate(sub.updatedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <SubscriptionActions sub={sub} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col divide-y">
              {result.items.map((sub) => (
                <article key={sub.id} className="flex flex-col gap-3 p-4">
                  <SubscriptionName sub={sub} busy={busy} onOpen={() => openEditor(sub.id)} wrap />
                  <Access sub={sub} wrap />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(sub.size)} · {formatDate(sub.updatedAt)}
                    </span>
                    <SubscriptionActions sub={sub} compact={compact} />
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="flex h-10 items-center justify-between gap-3 border-t px-4">
            <span className="text-xs text-muted-foreground">
              {searching ? `找到 ${result.total} 条` : `${collection.items.length} 条订阅`}
            </span>
            {result.pages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="上一页"
                  disabled={busy || result.page === 1}
                  onClick={() => updateView({ page: result.page - 1 })}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
                  {result.page} / {result.pages}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="下一页"
                  disabled={busy || result.page === result.pages}
                  onClick={() => updateView({ page: result.page + 1 })}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Empty className="min-h-64">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileCodeIcon />
              </EmptyMedia>
              <EmptyTitle>{searching ? '没有匹配的订阅' : '还没有订阅'}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              {searching ? (
                <Button variant="outline" onClick={() => updateView({ query: '', filter: 'all' })}>
                  清除筛选
                </Button>
              ) : (
                <Button variant="outline" onClick={() => openEditor()}>
                  新建订阅
                </Button>
              )}
            </EmptyContent>
          </Empty>
        </div>
      )}
    </div>
  )
}

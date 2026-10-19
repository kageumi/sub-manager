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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
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
import { useWorkspace } from '../app/Workspace.jsx'
import { useNavigation } from '../app/NavigationGuard.jsx'
import { selectSubscriptions, isRestricted } from '../subscriptions/model.js'
import { formatDate, formatBytes } from '../shared/format.js'
import { useMediaQuery } from '../shared/useMediaQuery.js'

const sorts = [
  { value: 'updated', label: '最近更新' },
  { value: 'name', label: '名称排序' },
]

function SubscriptionActions({ sub }) {
  const compact = useMediaQuery('(max-width: 639px)')
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

function Access({ sub }) {
  const rules = accessRules(sub)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AccessBadge sub={sub} />
      {rules.length > 0 && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">{rules.join(', ')}</span>
      )}
    </div>
  )
}

export function SubscriptionsPage() {
  const { collection, view, updateView, scroll, openEditor } = useWorkspace()
  const { busy } = useNavigation()
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>订阅列表</h1>
        </CardTitle>
        <CardDescription>共 {collection.items.length} 条订阅</CardDescription>
        <CardAction>
          <Button onClick={() => openEditor()} disabled={busy}>
            <PlusIcon data-icon="inline-start" />
            新建订阅
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <InputGroup className="lg:max-w-xs">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex flex-col gap-5 py-6" role="status" aria-label="正在加载订阅">
            {[0, 1, 2].map((key) => (
              <div key={key} className="flex justify-between gap-8">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : result.items.length ? (
          <>
            <div className="hidden rounded-lg border md:block">
              <Table
                aria-label="订阅列表"
                className="table-fixed [&_td]:px-4 [&_td]:py-3 [&_th]:px-4"
                aria-busy={collection.loading}
              >
                <TableHeader>
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
                        <div className="flex min-w-0 flex-col items-start gap-0.5">
                          <Button
                            variant="link"
                            className="h-auto max-w-full justify-start p-0"
                            disabled={busy}
                            onClick={() => openEditor(sub.id)}
                          >
                            <span className="truncate">{sub.name}</span>
                          </Button>
                          <span className="max-w-full truncate font-mono text-xs text-muted-foreground">
                            {sub.id}
                          </span>
                        </div>
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
            </div>
            <div className="flex flex-col divide-y rounded-lg border md:hidden">
              {result.items.map((sub) => {
                const rules = accessRules(sub)
                return (
                  <article key={sub.id} className="flex flex-col gap-3 p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Button
                        variant="link"
                        disabled={busy}
                        className="h-auto max-w-full justify-start p-0 text-left"
                        onClick={() => openEditor(sub.id)}
                      >
                        <span className="break-all whitespace-normal">{sub.name}</span>
                      </Button>
                      <span className="truncate font-mono text-xs text-muted-foreground">{sub.id}</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <AccessBadge sub={sub} />
                      {rules.length > 0 && (
                        <span className="min-w-0 text-xs break-words text-muted-foreground">
                          {rules.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(sub.size)} · {formatDate(sub.updatedAt)}
                      </span>
                      <SubscriptionActions sub={sub} />
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        ) : (
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
        )}
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {searching ? `找到 ${result.total} 条` : `${collection.items.length} 条订阅`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="上一页"
            disabled={busy || result.page === 1}
            onClick={() => updateView({ page: result.page - 1 })}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-12 text-center text-xs tabular-nums">
            {result.page} / {result.pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="下一页"
            disabled={busy || result.page === result.pages}
            onClick={() => updateView({ page: result.page + 1 })}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

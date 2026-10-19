import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { requestJson, setUnauthorizedHandler } from '../shared/api.js'
import { LoginPage } from '../pages/LoginPage.jsx'
import { PageBoundary } from './PageBoundary.jsx'
import { preloadWorkspace } from './preload.js'

const Workspace = lazy(() => import('./Workspace.jsx').then((module) => ({ default: module.Workspace })))
function LoadingView() {
  return (
    <main className="flex min-h-dvh items-center justify-center" role="status" aria-label="正在加载">
      <Spinner />
    </main>
  )
}
export function SessionApp() {
  const [authenticated, setAuthenticated] = useState(null)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const expireSession = useCallback(() => setAuthenticated(false), [])
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }, [])
  useEffect(() => {
    setUnauthorizedHandler(expireSession)
    return () => setUnauthorizedHandler(null)
  }, [expireSession])
  useEffect(() => {
    preloadWorkspace()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    requestJson('/api/session', { signal: controller.signal })
      .then((data) => {
        setAuthenticated(Boolean(data.authenticated))
        if (data.authenticated) setHasSession(true)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
    return () => controller.abort()
  }, [attempt])
  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <Alert variant="destructive" className="max-w-sm">
          <AlertTitle>连接失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => setAttempt((n) => n + 1)}>重新连接</Button>
      </main>
    )
  if (authenticated === null) return <LoadingView />
  return (
    <>
      {!authenticated && (
        <LoginPage
          restoring={hasSession}
          onSuccess={() => {
            setHasSession(true)
            setAuthenticated(true)
          }}
        />
      )}
      {hasSession && (
        <div hidden={!authenticated}>
          <PageBoundary>
            <Suspense fallback={<LoadingView />}>
              <Workspace
                active={authenticated}
                onLogout={() => {
                  setHasSession(false)
                  setAuthenticated(false)
                }}
              />
            </Suspense>
          </PageBoundary>
        </div>
      )}
    </>
  )
}

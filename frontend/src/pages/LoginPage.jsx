import { useEffect, useRef, useState } from 'react'
import { EyeIcon, EyeOffIcon, SquareTerminalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { AppearanceMenu } from '../shared/menus.jsx'
import { requestJson } from '../shared/api.js'

export function LoginPage({ onSuccess, restoring = false }) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)
  const busy = useRef(false)
  useEffect(() => {
    input.current?.focus()
  }, [])
  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    if (!password) {
      setError('请输入访问密码')
      input.current?.focus()
      return
    }
    busy.current = true
    setLoading(true)
    setError('')
    try {
      await requestJson('/api/login', { method: 'POST', body: { password } })
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }
  useEffect(() => {
    if (error && !loading) input.current?.focus()
  }, [error, loading])
  const VisibilityIcon = visible ? EyeOffIcon : EyeIcon
  return (
    <div className="relative grid min-h-dvh place-items-center bg-page p-5">
      <div className="absolute right-5 top-4">
        <AppearanceMenu />
      </div>
      <main className="w-full max-w-sm">
        <form onSubmit={submit} noValidate>
          <Card>
            <CardHeader>
              <CardTitle>
                <h1 className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                    <SquareTerminalIcon className="size-4" aria-hidden="true" />
                  </span>
                  <span>{restoring ? '重新登录' : '订阅管理'}</span>
                </h1>
              </CardTitle>
              <CardDescription>{restoring ? '登录后继续编辑' : '个人订阅工作空间'}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <FieldGroup>
                <Field data-invalid={Boolean(error)} data-disabled={loading}>
                  <FieldLabel htmlFor="access-password">访问密码</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      ref={input}
                      id="access-password"
                      type={visible ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      disabled={loading}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'password-error' : undefined}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setError('')
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={visible ? '隐藏密码' : '显示密码'}
                        aria-pressed={visible}
                        disabled={loading}
                        onClick={() => setVisible(!visible)}
                      >
                        <VisibilityIcon />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {error && <FieldError id="password-error">{error}</FieldError>}
                </Field>
              </FieldGroup>
              <Button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                aria-label={restoring ? '登录并继续' : '登录'}
                className="w-full"
              >
                {loading && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {restoring ? '登录并继续' : '登录'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  )
}

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const GuardContext = createContext(null)
export const useNavigation = () => useContext(GuardContext)

export function useEditorGuard({ dirty, busy, save }) {
  const { register } = useNavigation()
  useEffect(() => {
    register({ dirty, busy, save })
    return () => register(null)
  }, [register, dirty, busy, save])
}

export function NavigationGuard({ active, busy, children }) {
  const [editor, register] = useState(null)
  const [pending, setPending] = useState(false)
  const pendingAction = useRef(null)
  const [saving, setSaving] = useState(false)
  const cancelButton = useRef(null)
  const submitting = useRef(false)
  const blocked = busy || saving || Boolean(editor?.busy)
  useEffect(() => {
    if (!editor?.dirty) return
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editor?.dirty])
  function request(action) {
    if (blocked || submitting.current || pendingAction.current) return
    if (editor?.dirty) {
      pendingAction.current = action
      setPending(true)
    } else action()
  }
  function cancel() {
    pendingAction.current = null
    setPending(false)
  }
  function proceed() {
    const action = pendingAction.current
    pendingAction.current = null
    setPending(false)
    action?.()
  }
  async function saveAndLeave() {
    if (blocked || submitting.current) return
    submitting.current = true
    setSaving(true)
    try {
      const saved = await editor?.save()
      if (saved) proceed()
      else cancel()
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return (
    <GuardContext.Provider value={{ register, request, busy: blocked }}>
      {children}
      {active && pending && (
        <AlertDialog
          open
          onOpenChange={(open, details) => {
            if (blocked) details.cancel()
            else if (!open) cancel()
          }}
        >
          <AlertDialogContent initialFocus={cancelButton}>
            <AlertDialogHeader>
              <AlertDialogTitle>保存修改后再离开？</AlertDialogTitle>
              <AlertDialogDescription>当前订阅有未保存的修改。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="ghost" disabled={blocked} onClick={proceed}>
                不保存
              </Button>
              <Button ref={cancelButton} variant="outline" disabled={blocked} onClick={cancel}>
                继续编辑
              </Button>
              <Button disabled={blocked} onClick={saveAndLeave}>
                {saving && <Spinner data-icon="inline-start" aria-hidden="true" />}保存并离开
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </GuardContext.Provider>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
  danger = false,
  returnFocusTo,
}) {
  const cancel = useRef(null)
  const opener = useRef(returnFocusTo ?? document.activeElement)
  const submitting = useRef(false)
  const [working, setWorking] = useState(false)
  const mounted = useRef(true)
  const disabled = busy || working
  useEffect(
    () => () => {
      mounted.current = false
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    },
    [],
  )
  async function confirm() {
    if (disabled || submitting.current) return
    submitting.current = true
    setWorking(true)
    try {
      await onConfirm()
    } finally {
      submitting.current = false
      if (mounted.current) setWorking(false)
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open, details) => {
        if (disabled) details.cancel()
        else if (!open) onCancel()
      }}
    >
      <AlertDialogContent initialFocus={cancel} finalFocus={opener}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="break-all">{children}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel} disabled={disabled}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            variant={danger ? 'destructive' : 'default'}
            disabled={disabled}
            aria-label={confirmLabel}
            aria-busy={disabled}
            onClick={confirm}
          >
            {disabled && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

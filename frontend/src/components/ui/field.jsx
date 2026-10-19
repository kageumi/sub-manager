import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

function FieldGroup({ className, ...props }) {
  return <div data-slot="field-group" className={cn('flex w-full flex-col gap-5', className)} {...props} />
}

function Field({ className, ...props }) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn('group/field flex w-full flex-col gap-2 data-[invalid=true]:text-destructive', className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        'group/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function FieldError({ className, children, ...props }) {
  if (!children) return null
  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn('text-sm font-normal text-destructive', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Field, FieldLabel, FieldError, FieldGroup }

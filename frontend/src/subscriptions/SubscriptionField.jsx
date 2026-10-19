import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export const fieldId = (name) => `subscription-${name}`

export function SubscriptionField({ editor, name, label, multiline = false, ...props }) {
  const Control = multiline ? Textarea : Input
  const error = editor.errors[name]
  const disabled = editor.status !== 'ready'
  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled}>
      <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
      <Control
        id={fieldId(name)}
        value={editor.draft[name]}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId(name)}-error` : undefined}
        onChange={(event) => editor.change(name, event.target.value)}
        {...props}
      />
      {error && <FieldError id={`${fieldId(name)}-error`}>{error}</FieldError>}
    </Field>
  )
}

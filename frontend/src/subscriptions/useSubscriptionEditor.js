import { useCallback, useEffect, useRef, useState } from 'react'
import { subscriptionApi } from './api.js'
import { emptyDraft, draftFromSubscription, payloadFromDraft, validateDraft } from './model.js'
import { MAX_CONTENT_BYTES } from '../../../shared/subscription.js'

function initialState() {
  const draft = emptyDraft()
  return {
    current: null,
    draft,
    baseline: draft,
    status: 'ready',
    error: '',
    errors: {},
    validation: 0,
    revision: 0,
  }
}

// A draft lives with its page, not with the list or the global session.
export function useSubscriptionEditor(write) {
  const [state, setState] = useState(initialState)
  const latest = useRef(state)
  const request = useRef(null)
  const operation = useRef(false)
  const mounted = useRef(true)
  const imports = useRef(0)
  const commit = useCallback((patch) => {
    latest.current = { ...latest.current, ...patch }
    if (mounted.current) setState(latest.current)
  }, [])
  const accept = useCallback(
    (sub) => {
      const draft = draftFromSubscription(sub)
      commit({
        current: sub,
        draft,
        baseline: draft,
        errors: {},
        error: '',
        status: 'ready',
        revision: latest.current.revision + 1,
      })
    },
    [commit],
  )
  const cancel = useCallback(() => {
    request.current?.abort()
    request.current = null
    imports.current++
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancel()
    }
  }, [cancel])
  const open = useCallback(
    async (id) => {
      if (operation.current) return false
      cancel()
      if (!id) {
        commit({ ...initialState(), revision: latest.current.revision + 1 })
        return true
      }
      if (latest.current.current?.id === id) return true
      const controller = new AbortController()
      request.current = controller
      commit({ ...initialState(), status: 'loading', revision: latest.current.revision + 1 })
      try {
        const sub = await subscriptionApi.get(id, controller.signal)
        if (!mounted.current || controller.signal.aborted) return false
        accept(sub)
        return true
      } catch (err) {
        if (mounted.current && !controller.signal.aborted)
          commit({ status: 'load-error', error: err.message })
        return false
      }
    },
    [cancel, commit, accept],
  )
  const change = useCallback(
    (key, value) => {
      if (operation.current || latest.current.status !== 'ready') return false
      commit({
        draft: { ...latest.current.draft, [key]: value },
        errors: { ...latest.current.errors, [key]: undefined },
        error: '',
      })
      return true
    },
    [commit],
  )
  const reset = useCallback(() => {
    if (operation.current) return
    imports.current++
    commit({ draft: latest.current.baseline, errors: {}, error: '', revision: latest.current.revision + 1 })
  }, [commit])
  const save = useCallback(async () => {
    if (operation.current || latest.current.status !== 'ready') return false
    const { draft, current } = latest.current
    const errors = validateDraft(draft)
    commit({ errors, error: '' })
    if (Object.keys(errors).length) {
      commit({ validation: latest.current.validation + 1 })
      return false
    }
    operation.current = true
    commit({ status: 'saving' })
    try {
      const sub = await write(payloadFromDraft(draft), current?.id)
      if (!mounted.current) return false
      accept(sub)
      return sub
    } catch (err) {
      commit({ status: 'ready', error: err.message })
      return false
    } finally {
      operation.current = false
    }
  }, [write, commit, accept])
  const importFile = useCallback(
    async (file) => {
      const before = latest.current
      if (operation.current || before.status !== 'ready') return false
      if (file.size > MAX_CONTENT_BYTES) throw new Error('文件不能超过 24 MB')
      const attempt = ++imports.current
      const content = await file.text()
      if (
        !mounted.current ||
        attempt !== imports.current ||
        latest.current.revision !== before.revision ||
        operation.current
      )
        return false
      if (latest.current.draft.content !== before.draft.content) throw new Error('配置已修改，请重新导入文件')
      if (new TextEncoder().encode(content).byteLength > MAX_CONTENT_BYTES)
        throw new Error('文件不能超过 24 MB')
      return change('content', content)
    },
    [change],
  )
  const dirty = Object.keys(state.draft).some((key) => state.draft[key] !== state.baseline[key])
  return { ...state, dirty, busy: state.status === 'saving', open, cancel, change, reset, save, importFile }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { subscriptionApi } from './api.js'

// The collection owns KV consistency: writes patch local metadata, never read it back.
export function useSubscriptions() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [writing, setWriting] = useState(false)
  const request = useRef(null)
  const mounted = useRef(false)
  const lock = useRef(false)
  const invalidate = useCallback(() => {
    request.current?.abort()
    request.current = null
    setLoading(false)
    setError('')
  }, [])
  const refresh = useCallback(async () => {
    if (lock.current) return false
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const result = await subscriptionApi.list(controller.signal)
      if (mounted.current && request.current === controller) setItems(result)
      return true
    } catch (err) {
      if (mounted.current && !controller.signal.aborted) setError(err.message)
      return false
    } finally {
      if (mounted.current && request.current === controller) setLoading(false)
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    refresh()
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [refresh])
  const save = useCallback(
    async (payload, existingId) => {
      if (lock.current) throw new Error('请等待当前操作完成')
      lock.current = true
      setWriting(true)
      try {
        const saved = await subscriptionApi.save(payload, existingId)
        if (mounted.current) {
          invalidate()
          const { content: _content, ...metadata } = saved
          setItems((previous) => [metadata, ...previous.filter((sub) => sub.id !== saved.id)])
        }
        return saved
      } finally {
        lock.current = false
        if (mounted.current) setWriting(false)
      }
    },
    [invalidate],
  )
  const remove = useCallback(
    async (id) => {
      if (lock.current) throw new Error('请等待当前操作完成')
      lock.current = true
      setWriting(true)
      try {
        await subscriptionApi.remove(id)
        if (mounted.current) {
          invalidate()
          setItems((previous) => previous.filter((sub) => sub.id !== id))
        }
      } finally {
        lock.current = false
        if (mounted.current) setWriting(false)
      }
    },
    [invalidate],
  )
  return { items, loading, error, writing, refresh, save, remove }
}

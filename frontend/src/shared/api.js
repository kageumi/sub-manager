let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export async function requestJson(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('网络连接失败，请检查网络后重试')
  }
  signal?.throwIfAborted()
  let data = null
  try {
    data = await response.json()
  } catch (err) {
    if (err.name === 'AbortError') throw err
    /* Handled below. */
  }
  signal?.throwIfAborted()
  if (response.status === 401 && path !== '/api/login') {
    unauthorizedHandler?.()
    throw new Error('登录状态已失效，请重新登录')
  }
  if (!response.ok) throw new Error(data?.error ?? `请求失败（HTTP ${response.status}）`)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('服务器返回了无效数据，请重试')
  return data
}

import { route } from './router.js'
import { error } from './lib/http.js'

export default {
  async fetch(request, env) {
    try {
      return await route(request, env)
    } catch (err) {
      console.error('Unhandled error:', err?.stack ?? err)
      return error(500, '服务器内部错误')
    }
  },
}

import { text } from '../lib/http.js'

export function handleRobots() {
  return text('User-agent: *\nDisallow: /\n', {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  })
}

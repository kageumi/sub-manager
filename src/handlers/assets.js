import { text } from '../lib/http.js'
import appScript from '../ui/app.js'
import loginScript from '../ui/login.js'
import styles from '../ui/styles.css'

const ASSETS = new Map([
  ['/app.js', { body: appScript, contentType: 'text/javascript; charset=utf-8' }],
  ['/login.js', { body: loginScript, contentType: 'text/javascript; charset=utf-8' }],
  ['/app.css', { body: styles, contentType: 'text/css; charset=utf-8' }],
])

export function handleAsset(pathname) {
  const asset = ASSETS.get(pathname)
  if (!asset) return null

  return text(asset.body, {
    contentType: asset.contentType,
    headers: { 'Cache-Control': 'no-store' },
  })
}

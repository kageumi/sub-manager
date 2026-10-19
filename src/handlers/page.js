import { CONTENT_SECURITY_POLICY, html } from '../lib/http.js'
import page from '../../dist/index.html'

export function handlePage() {
  return html(page, {
    headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
  })
}

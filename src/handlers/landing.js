import { siteName } from '../lib/config.js'
import { CONTENT_SECURITY_POLICY, html } from '../lib/http.js'
import { renderTemplate } from '../lib/template.js'
import page from '../ui/home.html'

export function handleLanding(request, env) {
  return html(renderTemplate(page, { SITE_NAME: siteName(env) }), {
    headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
  })
}

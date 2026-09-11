import { isAuthenticated } from '../lib/auth.js'
import { siteName } from '../lib/config.js'
import { CONTENT_SECURITY_POLICY, html, redirect } from '../lib/http.js'
import { renderTemplate } from '../lib/template.js'
import page from '../ui/index.html'

export async function handleAdmin(request, env) {
  if (!(await isAuthenticated(request, env))) return redirect('/login')

  return html(renderTemplate(page, { SITE_NAME: siteName(env) }), {
    headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY },
  })
}

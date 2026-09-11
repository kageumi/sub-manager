import 'https://esm.sh/@material/web@2.5.0/all.js'

const API = '/api/subs'
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

const $ = (id) => document.getElementById(id)

const els = {
  list: $('sub-list'),
  empty: $('empty'),
  count: $('count'),
  title: $('editor-title'),
  subtitle: $('editor-sub'),
  form: $('form'),
  id: $('field-id'),
  name: $('field-name'),
  contentType: $('field-content-type'),
  filename: $('field-filename'),
  countries: $('field-countries'),
  domains: $('field-domains'),
  userinfo: $('field-userinfo'),
  content: $('field-content'),
  saveButton: $('save'),
  removeButton: $('delete'),
  copyButton: $('copy'),
  addButton: $('add'),
  refreshButton: $('refresh'),
  logoutButton: $('logout'),
  dialog: $('confirm'),
  toast: $('toast'),
  toastIcon: $('toast-icon'),
  toastText: $('toast-text'),
}

let subscriptions = []
let currentId = null
let toastTimer = 0

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  )
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

function setFieldError(field, message) {
  field.error = Boolean(message)
  field.errorText = message ?? ''
}

function clearFieldErrors() {
  for (const field of [els.id, els.name, els.content]) setFieldError(field, '')
}

function showToast(message, type = 'success') {
  clearTimeout(toastTimer)
  els.toastText.textContent = message
  els.toastIcon.textContent = type === 'error' ? 'error' : 'check_circle'
  els.toast.dataset.type = type
  els.toast.classList.add('show')
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200)
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (response.status === 401) {
    location.replace('/login')
    throw new Error('登录状态已失效，请重新登录')
  }

  if (!response.ok) throw new Error(data?.error ?? `请求失败（HTTP ${response.status}）`)
  return data
}

function renderList() {
  els.count.textContent = subscriptions.length
  els.empty.hidden = subscriptions.length > 0
  els.list.hidden = subscriptions.length === 0

  els.list.innerHTML = subscriptions
    .map((sub) => {
      const restricted = sub.allowedCountries?.length || sub.allowedDomains?.length
      const scope = sub.allowedCountries?.length
        ? sub.allowedCountries.join(', ')
        : sub.allowedDomains?.length
          ? sub.allowedDomains.join(', ')
          : '无限制'
      return `
      <md-list-item type="button" data-id="${escapeHtml(sub.id)}">
        <md-icon slot="start">${restricted ? 'public' : 'key'}</md-icon>
        <div slot="headline">${escapeHtml(sub.name || sub.id)}</div>
        <div slot="supporting-text">${escapeHtml(scope)} · ${escapeHtml(formatBytes(sub.size))}</div>
      </md-list-item>`
    })
    .join('')

  markActive(currentId)
}

function markActive(id) {
  for (const item of els.list.querySelectorAll('md-list-item')) {
    if (item.dataset.id === id) item.setAttribute('data-active', '')
    else item.removeAttribute('data-active')
  }
}

async function loadList() {
  const { subs } = await requestJson(API)
  subscriptions = subs
  renderList()
}

function setFormValues({
  id = '',
  name = '',
  contentType = '',
  filename = '',
  countries = '',
  domains = '',
  userinfo = '',
  content = '',
}) {
  els.id.value = id
  els.name.value = name
  els.contentType.value = contentType
  els.filename.value = filename
  els.countries.value = countries
  els.domains.value = domains
  els.userinfo.value = userinfo
  els.content.value = content
}

function resetForm() {
  currentId = null
  clearFieldErrors()
  setFormValues({})
  els.id.disabled = false
  els.title.textContent = '新建订阅'
  els.subtitle.textContent = '填写信息后保存'
  els.removeButton.hidden = true
  els.copyButton.hidden = true
  markActive(null)
  els.name.focus()
}

async function selectSubscription(id) {
  try {
    const { sub } = await requestJson(`${API}/${encodeURIComponent(id)}`)
    currentId = sub.id
    clearFieldErrors()
    setFormValues({
      id: sub.id,
      name: sub.name ?? '',
      contentType: sub.contentType ?? '',
      filename: sub.filename ?? '',
      countries: (sub.allowedCountries ?? []).join(', '),
      domains: (sub.allowedDomains ?? []).join(', '),
      userinfo: sub.subscriptionUserinfo ?? '',
      content: sub.content ?? '',
    })
    els.id.disabled = true
    els.title.textContent = sub.name || sub.id
    els.subtitle.textContent = publicUrlFor(sub.id)
    els.removeButton.hidden = false
    els.copyButton.hidden = false
    markActive(sub.id)
  } catch (err) {
    showToast(err.message, 'error')
    await loadList().catch(() => {})
  }
}

function validateForm() {
  clearFieldErrors()
  let valid = true

  if (!ID_PATTERN.test(els.id.value.trim())) {
    setFieldError(els.id, '需以字母或数字开头，只能包含字母、数字、.、_、-')
    valid = false
  }
  if (!els.name.value.trim()) {
    setFieldError(els.name, '请填写订阅名称')
    valid = false
  }
  if (!els.content.value.trim()) {
    setFieldError(els.content, '请填写订阅内容')
    valid = false
  }
  return valid
}

async function saveSubscription() {
  if (!validateForm()) return

  const payload = {
    id: els.id.value.trim(),
    name: els.name.value.trim(),
    contentType: els.contentType.value.trim(),
    filename: els.filename.value.trim(),
    allowedCountries: els.countries.value,
    allowedDomains: els.domains.value,
    subscriptionUserinfo: els.userinfo.value.trim(),
    content: els.content.value,
  }

  els.saveButton.disabled = true
  try {
    if (currentId) {
      await requestJson(`${API}/${encodeURIComponent(currentId)}`, { method: 'PUT', body: payload })
      showToast('订阅已更新')
    } else {
      await requestJson(API, { method: 'POST', body: payload })
      showToast('订阅已创建')
    }
    await loadList()
    await selectSubscription(payload.id)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    els.saveButton.disabled = false
  }
}

function confirmDelete() {
  return new Promise((resolve) => {
    const onClose = () => {
      els.dialog.removeEventListener('close', onClose)
      resolve(els.dialog.returnValue === 'confirm')
    }
    els.dialog.addEventListener('close', onClose)
    els.dialog.returnValue = ''
    els.dialog.show()
  })
}

async function deleteSubscription() {
  if (!currentId) return
  if (!(await confirmDelete())) return

  try {
    await requestJson(`${API}/${encodeURIComponent(currentId)}`, { method: 'DELETE' })
    showToast('订阅已删除')
    resetForm()
    await loadList()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

function publicUrlFor(id) {
  const domains = els.domains.value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const base = domains.length ? `https://${domains[0].replace(/^\*\./, '')}` : location.origin
  return `${base}/${id}`
}

async function copyLink() {
  if (!currentId) return
  try {
    await navigator.clipboard.writeText(publicUrlFor(currentId))
    showToast('链接已复制')
  } catch {
    showToast('复制失败，请手动复制链接', 'error')
  }
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault()
  saveSubscription()
})

els.list.addEventListener('click', (event) => {
  const item = event.target.closest('md-list-item')
  if (item?.dataset.id) selectSubscription(item.dataset.id)
})

els.addButton.addEventListener('click', resetForm)
$('empty-add').addEventListener('click', resetForm)
els.saveButton.addEventListener('click', saveSubscription)
els.removeButton.addEventListener('click', deleteSubscription)
els.copyButton.addEventListener('click', copyLink)
$('confirm-cancel').addEventListener('click', () => els.dialog.close('cancel'))
$('confirm-delete').addEventListener('click', () => els.dialog.close('confirm'))

els.refreshButton.addEventListener('click', async () => {
  try {
    await loadList()
    showToast('列表已刷新')
  } catch (err) {
    showToast(err.message, 'error')
  }
})

els.logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' })
  } catch {
    // ignore and redirect anyway
  }
  location.replace('/login')
})

loadList().catch((err) => showToast(err.message, 'error'))
resetForm()

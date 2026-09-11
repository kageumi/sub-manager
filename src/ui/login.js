import 'https://esm.sh/@material/web@2.5.0/all.js'

const $ = (id) => document.getElementById(id)

const form = $('login-form')
const username = $('username')
const password = $('password')
const submit = $('submit')
const errorEl = $('error')
const togglePassword = $('toggle-password')

function showError(message) {
  errorEl.textContent = message
  username.error = Boolean(message)
  password.error = Boolean(message)
}

togglePassword.addEventListener('click', () => {
  const reveal = password.type === 'password'
  password.type = reveal ? 'text' : 'password'
  togglePassword.querySelector('md-icon').textContent = reveal ? 'visibility_off' : 'visibility'
  togglePassword.setAttribute('aria-label', reveal ? '隐藏密码' : '显示密码')
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  showError('')

  if (!username.value.trim() || !password.value) {
    username.error = !username.value.trim()
    password.error = !password.value
    errorEl.textContent = '请填写用户名和密码'
    return
  }

  submit.disabled = true
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value.trim(), password: password.value }),
    })

    if (response.ok) {
      location.replace('/admin')
      return
    }

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    showError(data?.error ?? '登录失败，请重试')
  } catch {
    showError('网络异常，请稍后重试')
  } finally {
    submit.disabled = false
  }
})

username.focus()

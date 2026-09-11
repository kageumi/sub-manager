export function renderTemplate(body, variables = {}) {
  return String(body).replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in variables ? String(variables[key]) : match,
  )
}

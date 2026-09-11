import font from '../ui/material-symbols.woff2'

export function handleFont() {
  return new Response(font, {
    headers: {
      'Content-Type': 'font/woff2',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

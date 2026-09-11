const BOT_AGENTS = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'bingpreview',
  'facebookexternalhit',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'twitterbot',
  'linkedinbot',
  'embedly',
  'pinterest',
  'semrush',
  'ahrefs',
  'mj12bot',
  'dotbot',
  'blexbot',
  'yandex',
  'baiduspider',
  'sogou',
  '360spider',
  'bytespider',
  'petalbot',
  'duckduckbot',
  'applebot',
  'ia_archiver',
  'archive\\.org_bot',
  'censys',
  'shodan',
  'zgrab',
  'masscan',
  'nuclei',
  'scrapy',
  'python-requests',
  'aiohttp',
  'httpx',
  'wget',
  'curl',
  'libwww-perl',
  'node-fetch',
  'axios',
]

const BOT_USER_AGENT_PATTERN = new RegExp(`(${BOT_AGENTS.join('|')})`, 'i')

const SUBSCRIPTION_CLIENT_PATTERN =
  /(clash|mihomo|sing-box|stash|shadowrocket|quantumult|surge|loon|v2ray|nekobox|nekoray|hiddify|surfboard|flclash|clash-verge|sub-store|subconverter)/i

export function isBlockedCrawler(request) {
  const userAgent = request.headers.get('User-Agent') || ''
  if (!userAgent.trim()) return true
  if (SUBSCRIPTION_CLIENT_PATTERN.test(userAgent)) return false
  if (BOT_USER_AGENT_PATTERN.test(userAgent)) return true

  const purpose = `${request.headers.get('Purpose') || ''} ${request.headers.get('Sec-Purpose') || ''}`
  if (/(prefetch|preview|prerender)/i.test(purpose)) return true

  return false
}

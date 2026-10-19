import { describe, expect, test } from 'bun:test'
import { formatBytes, formatDate } from '../frontend/src/shared/format.js'

describe('列表格式化', () => {
  test('字节数按单位缩放', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536 * 1024)).toBe('1.50 MB')
    expect(formatBytes(undefined)).toBe('0 B')
  })
  test('缺失或无效时间显示占位文案', () => {
    expect(formatDate()).toBe('暂无记录')
    expect(formatDate(0)).toBe('暂无记录')
    expect(formatDate('not-a-date')).toBe('暂无记录')
  })
  test('同年时间不显示年份，跨年时间带年份', () => {
    const current = new Date()
    expect(formatDate(current.getTime())).not.toContain(String(current.getFullYear()))
    expect(formatDate(new Date('2020-05-04T08:00:00Z').getTime())).toContain('2020')
  })
})

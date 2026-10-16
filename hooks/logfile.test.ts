import { describe, expect, test } from 'claude-code/testing'

import { KEEP_LINES, appendedLog, resolveLogPath } from './logfile'

describe('resolveLogPath', () => {
  test('a configured path wins', () => {
    expect(resolveLogPath('/var/log/pp.log', '/home/x')).toBe('/var/log/pp.log')
  })
  test('the default lives under the home directory, with or without a trailing slash', () => {
    expect(resolveLogPath('', '/Users/ijat')).toBe('/Users/ijat/.claude/prompt-polish.log')
    expect(resolveLogPath('', 'C:\\Users\\ijat\\')).toBe('C:\\Users\\ijat/.claude/prompt-polish.log')
  })
  test('no home and no path means no log', () => {
    expect(resolveLogPath('', undefined)).toBe(null)
  })
})

describe('appendedLog', () => {
  test('adds a timestamped line', () => {
    expect(appendedLog('', 'skipped (pasted content)', Date.UTC(2026, 9, 16, 4, 0, 0))).toBe('2026-10-16T04:00:00.000Z skipped (pasted content)\n')
  })
  test('keeps earlier lines and caps the length', () => {
    let log = ''
    for (let i = 0; i < KEEP_LINES + 25; i++) log = appendedLog(log, `line ${i}`, 0)
    const lines = log.trim().split('\n')
    expect(lines.length).toBe(KEEP_LINES)
    expect(lines[lines.length - 1]).toContain(`line ${KEEP_LINES + 24}`)
    expect(lines[0]).toContain('line 25')
  })
})

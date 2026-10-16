import { describe, expect, test } from 'claude-code/testing'

import { clean, hasTip, parse } from './protocol'

describe('parse', () => {
  test('reads action, confidence, rewrite and tip', () => {
    const p = parse('ACTION:\nimprove\nCONFIDENCE:\nlow\nREWRITE:\nFix the login bug.\nTIP:\nSay what fails.')
    expect(p).toEqual({ action: 'improve', isConfident: false, rewrite: 'Fix the login bug.', tip: 'Say what fails.' })
  })
  test('a missing confidence counts as confident', () => {
    expect(parse('ACTION:\ngrammar\nREWRITE:\nx y\nTIP:\nnone')?.isConfident).toBe(true)
  })
  test('the improve format has no action', () => {
    expect(parse('REWRITE:\nx\nTIP:\nnone')?.action).toBe(undefined)
  })
  test('rejects a reply that breaks the format', () => {
    expect(parse('Sure! Here is your prompt.')).toBe(null)
  })
  test('rejects an echoed placeholder or an empty rewrite', () => {
    expect(parse('ACTION:\ngrammar\nCONFIDENCE:\nhigh\nREWRITE:\n<the corrected prompt>\nTIP:\nnone')).toBe(null)
    expect(parse('REWRITE:\n\nTIP:\nnone')).toBe(null)
  })
})

describe('text helpers', () => {
  test('clean drops the replacement character and control codes', () => {
    expect(clean(' a�b\u0007c ')).toBe('abc')
  })
  test('"none" is not a tip', () => {
    expect(hasTip('none')).toBe(false)
    expect(hasTip('None.')).toBe(false)
    expect(hasTip('Use "its" without an apostrophe.')).toBe(true)
  })
})

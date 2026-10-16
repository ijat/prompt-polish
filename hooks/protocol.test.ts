import { describe, expect, test } from 'claude-code/testing'

import { FAST_SYSTEM_TYPED, FAST_SYSTEM_VOICE, IMPROVE_SYSTEM, asData, clean, hasTip, parse } from './protocol'

describe('parse', () => {
  test('reads action, confidence, rewrite and tip', () => {
    const p = parse('ACTION:\nimprove\nCONFIDENCE:\n35\nREWRITE:\nFix the login bug.\nTIP:\nSay what fails.')
    expect(p).toEqual({ action: 'improve', confidence: 35, errors: [], rewrite: 'Fix the login bug.', tip: 'Say what fails.' })
  })
  test('a missing confidence counts as fully confident', () => {
    expect(parse('ACTION:\ngrammar\nREWRITE:\nx y\nTIP:\nnone')?.confidence).toBe(100)
  })
  test('confidence is capped at 100', () => {
    expect(parse('ACTION:\ngrammar\nCONFIDENCE:\n250\nREWRITE:\nx y\nTIP:\nnone')?.confidence).toBe(100)
  })
  test('the improve format has no action', () => {
    expect(parse('REWRITE:\nx\nTIP:\nnone')?.action).toBe(undefined)
  })
  test('rejects a reply that breaks the format', () => {
    expect(parse('Sure! Here is your prompt.')).toBe(null)
  })
  test('rejects an echoed placeholder or an empty rewrite', () => {
    expect(parse('ACTION:\ngrammar\nCONFIDENCE:\n90\nREWRITE:\n<the corrected prompt>\nTIP:\nnone')).toBe(null)
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

describe('the model prompts are fully assembled', () => {
  const prompts = { voice: FAST_SYSTEM_VOICE, typed: FAST_SYSTEM_TYPED, improve: IMPROVE_SYSTEM }
  for (const [name, text] of Object.entries(prompts)) {
    test(`${name} prompt has no unfilled template parts`, () => {
      expect(text).not.toContain('[object Object]')
      expect(text).not.toContain('${')
      expect(text).not.toContain('undefined')
      expect(text).toContain('<prompt>')
      expect(text).toContain('REWRITE:')
      expect(text).toContain('TIP:')
    })
  }
  test('the fast prompts ask for an action and a confidence; the improve prompt does not', () => {
    expect(FAST_SYSTEM_VOICE).toContain('CONFIDENCE:')
    expect(FAST_SYSTEM_TYPED).toContain('ACTION:')
    expect(IMPROVE_SYSTEM).not.toContain('CONFIDENCE:')
  })
  test('asData fences the text', () => {
    expect(asData('hi there')).toBe('<prompt>\nhi there\n</prompt>')
  })
})

describe('error codes', () => {
  const reply = (errors: string) => `ACTION:\ngrammar\nCONFIDENCE:\n90\nERRORS:\n${errors}\nREWRITE:\nFix it now.\nTIP:\nnone`

  test('known codes are kept, unknown ones dropped, duplicates collapsed', () => {
    expect(parse(reply('Spelling, article-missing, spelling, banana'))?.errors).toEqual(['spelling', 'article-missing'])
  })
  test('none and a missing line both mean no errors', () => {
    expect(parse(reply('none'))?.errors).toEqual([])
    expect(parse('ACTION:\ngrammar\nCONFIDENCE:\n90\nREWRITE:\nFix it now.\nTIP:\nnone')?.errors).toEqual([])
  })
  test('the codes may share the label line', () => {
    expect(parse('ERRORS: stutter, filler\nREWRITE:\nFix it now.\nTIP:\nnone')?.errors).toEqual(['stutter', 'filler'])
  })
  test('the voice prompt offers the speech codes, the typed prompt does not', () => {
    expect(FAST_SYSTEM_VOICE).toContain('stutter')
    expect(FAST_SYSTEM_VOICE).toContain('spelling')
    expect(FAST_SYSTEM_TYPED).toContain('spelling')
    expect(FAST_SYSTEM_TYPED).not.toContain('stutter')
    expect(FAST_SYSTEM_TYPED).not.toContain('false-start')
  })
})

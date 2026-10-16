import { describe, expect, test } from 'claude-code/testing'

import { explicitImprove, structure } from './gate'
import { parse } from './protocol'

describe('parse robustness', () => {
  const wrap = (rewrite: string, extra = '') => `ACTION:\ngrammar\nCONFIDENCE:\n${extra || '90'}\nREWRITE:\n${rewrite}\nTIP:\nnone`

  test('reply wrapped in a code fence', () => {
    expect(parse('```\n' + wrap('Fix the bug.') + '\n```')?.rewrite).toBe('Fix the bug.')
  })
  test('confidence written as a percent', () => {
    expect(parse(wrap('x y z', '85%'))?.confidence).toBe(85)
  })
  test('confidence written as a decimal fraction', () => {
    expect(parse(wrap('x y z', '0.9'))?.confidence).toBe(90)
  })
  test('lowercase labels', () => {
    expect(parse('action: grammar\nconfidence: 80\nrewrite:\nFix it now.\ntip:\nnone')?.rewrite).toBe('Fix it now.')
  })
  test('the prompt itself mentions TIP: and REWRITE: (rewrite must not be truncated)', () => {
    const r = parse(wrap('Explain what the TIP: label and the REWRITE: label mean in this file.'))
    expect(r?.rewrite).toBe('Explain what the TIP: label and the REWRITE: label mean in this file.')
  })
  test('inline label mentions inside a multi-sentence rewrite', () => {
    const r = parse(wrap('Add a TIP: section. Then add a REWRITE: section.'))
    expect(r?.rewrite).toBe('Add a TIP: section. Then add a REWRITE: section.')
  })
  test('angle brackets inside a real rewrite are fine', () => {
    expect(parse(wrap('Render a <div> with class <name>.'))?.rewrite).toBe('Render a <div> with class <name>.')
  })
  test('a rewrite that is only a tag is treated as unusable (known limit)', () => {
    expect(parse(wrap('<Component />'))).toBe(null)
  })
  test('missing TIP label falls back to the original', () => {
    expect(parse('ACTION:\ngrammar\nCONFIDENCE:\n90\nREWRITE:\nFix it.')).toBe(null)
  })
})

describe('structure edge cases', () => {
  test('CRLF line breaks', () => {
    expect(structure('one\r\ntwo three four', 250)).toBe('multi-line')
  })
  test('dates and ranges with dashes are not lists', () => {
    expect(structure('deploy on 2026-10-16 - then check the logs for errors', 250)).toBe(null)
  })
  test('two spaced dashes in a sentence are not a list when used as dashes', () => {
    expect(structure('the fix - which is small - should go in today', 250)).toBe(null)
  })
  test('a numbered list on one line', () => {
    expect(structure('steps are 1) open it 2) press save 3) close it', 250)).toBe('list')
  })
  test('a sentence that ends in a number then a period', () => {
    expect(structure('we waited 5. Then we waited 6. Then we left', 250)).toBe(null)
  })
  test('exactly the word limit is allowed, one over is not', () => {
    expect(structure('w '.repeat(250), 250)).toBe(null)
    expect(structure('w '.repeat(251), 250)).toBe('over 250 words')
  })
})

describe('explicit improve variants', () => {
  test('with a capital and a colon, from dictation', () => {
    expect(explicitImprove('Improve: add dark mode to settings').isExplicit).toBe(true)
  })
  test('"improve this prompt" followed by a colon', () => {
    expect(explicitImprove('Improve this prompt: add dark mode to settings').isExplicit).toBe(true)
  })
  test('a plain request that merely starts with improve is not explicit', () => {
    expect(explicitImprove('Improve the login page performance').isExplicit).toBe(false)
  })
  test('the phrase in the middle is not explicit', () => {
    expect(explicitImprove('please improve this prompt handling code in the parser').isExplicit).toBe(false)
  })
})

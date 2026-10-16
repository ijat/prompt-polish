import { describe, expect, test } from 'claude-code/testing'

import { explicitImprove, skipReason, structure } from './gate'
import type { Input } from './gate'
import { DEFAULTS } from './settings'

const input = (text: string, extra: Partial<Input> = {}): Input => ({ text, isCommand: false, isMeta: false, originKind: 'composer', pastedChars: 0, source: 'voice', ...extra })

describe('structure', () => {
  test('a flat dictated paragraph has none', () => {
    expect(structure('so the thing with login is not working can you look at it', 250)).toBe(null)
  })
  test('line breaks, fences and lists mark a typed prompt', () => {
    expect(structure('a\n\nb c d e', 250)).toBe('multi-line')
    expect(structure('look at ```x``` please now', 250)).toBe('code block')
    expect(structure('do this: - one - two - three', 250)).toBe('list')
    expect(structure('1. first 2. second', 250)).toBe('list')
  })
  test('a single dash is not a list', () => {
    expect(structure('it is a well-known fix - see the docs for more detail', 250)).toBe(null)
  })
  test('over the word limit', () => {
    expect(structure('word '.repeat(11), 10)).toBe('over 10 words')
  })
})

describe('explicitImprove', () => {
  test('a leading "improve:" is an explicit request and is stripped', () => {
    expect(explicitImprove('improve: add dark mode to the settings page')).toEqual({ isExplicit: true, text: 'add dark mode to the settings page' })
    expect(explicitImprove('Please polish this prompt - fix the login bug')).toEqual({ isExplicit: true, text: 'fix the login bug' })
  })
  test('a trailing "improve this prompt" is an explicit request', () => {
    expect(explicitImprove('fix the login bug, improve this prompt.')).toEqual({ isExplicit: true, text: 'fix the login bug' })
  })
  test('ordinary prompts that mention improving are not', () => {
    expect(explicitImprove('improve the performance of the login page').isExplicit).toBe(false)
    expect(explicitImprove('can you improve this function please').isExplicit).toBe(false)
  })
  test('the phrase alone leaves nothing to improve', () => {
    expect(explicitImprove('improve this prompt').isExplicit).toBe(false)
  })
})

describe('skipReason', () => {
  const flat = 'fix the login page it is broken now'
  test('a flat human prompt is a candidate', () => {
    expect(skipReason(input(flat), DEFAULTS, false)).toBe(null)
    expect(skipReason(input(flat, { originKind: 'bridge' }), DEFAULTS, false)).toBe(null)
  })
  test('commands, hidden prompts and non-human origins are skipped', () => {
    expect(skipReason(input(flat, { isCommand: true }), DEFAULTS, false)).toBe('slash command')
    expect(skipReason(input(flat, { isMeta: true }), DEFAULTS, false)).toBe('hidden prompt')
    expect(skipReason(input(flat, { originKind: 'sdk' }), DEFAULTS, false)).toBe('origin sdk')
  })
  test('pasted content is left alone, even for an explicit improve request', () => {
    expect(skipReason(input(flat, { pastedChars: 500 }), DEFAULTS, false)).toBe('pasted content')
    expect(skipReason(input(flat, { pastedChars: 500 }), DEFAULTS, true)).toBe('pasted content')
  })
  test('a short paste (a path, a name) does not block the rewrite', () => {
    expect(skipReason(input(flat, { pastedChars: 12 }), DEFAULTS, false)).toBe(null)
    expect(skipReason(input(flat, { pastedChars: 12 }), { ...DEFAULTS, minPastedChars: 10 }, false)).toBe('pasted content')
  })
  test('too short is skipped, and the limit is configurable', () => {
    expect(skipReason(input('yes please'), DEFAULTS, false)).toBe('under 4 words')
    expect(skipReason(input('yes please'), { ...DEFAULTS, minWords: 2 }, false)).toBe(null)
  })
  test('structure skips a prompt unless the person explicitly asked to improve it', () => {
    const typed = input('improve:\n- add a page\n- add tests')
    expect(skipReason(typed, DEFAULTS, false)).toBe('structured prompt: multi-line')
    expect(skipReason(typed, DEFAULTS, true)).toBe(null)
  })
})

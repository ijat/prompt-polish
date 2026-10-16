import { describe, expect, test } from 'claude-code/testing'

import { PasteTracker } from './provenance'

const PASTE = 'Traceback (most recent call last): File "app.py", line 3, in <module> ValueError: bad input'

describe('PasteTracker', () => {
  test('keystrokes are not pastes', () => {
    const t = new PasteTracker()
    for (const ch of 'hello there') t.record({ hasKey: true, inputText: ch })
    expect(t.pastedChars('hello there')).toBe(0)
  })

  test('a no-key edit with text is a paste, counted by its length', () => {
    const t = new PasteTracker()
    t.record({ hasKey: false, inputText: PASTE })
    expect(t.pastedChars(`why does this fail? ${PASTE}`)).toBe(PASTE.length)
  })

  test('deletions and cursor moves (no text) are ignored', () => {
    const t = new PasteTracker()
    t.record({ hasKey: false, inputText: '' })
    expect(t.pastedChars('anything')).toBe(0)
  })

  test('a paste that is no longer in the submitted text does not count', () => {
    const t = new PasteTracker()
    t.record({ hasKey: false, inputText: PASTE })
    expect(t.pastedChars('a different, fresh prompt altogether')).toBe(0)
  })

  test('several pastes add up', () => {
    const t = new PasteTracker()
    const other = 'second pasted block with its own distinct opening words here'
    t.record({ hasKey: false, inputText: PASTE })
    t.record({ hasKey: false, inputText: other })
    expect(t.pastedChars(`${PASTE}\n${other}`)).toBe(PASTE.length + other.length)
  })

  test('reset forgets everything', () => {
    const t = new PasteTracker()
    t.record({ hasKey: false, inputText: PASTE })
    t.reset()
    expect(t.pastedChars(PASTE)).toBe(0)
  })
})

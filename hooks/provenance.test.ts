import { describe, expect, test } from 'claude-code/testing'

import { DraftTracker, resolveSource } from './provenance'

const PASTE = 'Traceback (most recent call last): File "app.py", line 3, in <module> ValueError: bad input'
const key = (ch: string) => ({ hasKey: true, inputText: ch })
const paste = (text: string) => ({ hasKey: false, inputText: text })

describe('pasted content', () => {
  test('keystrokes are not pastes', () => {
    const t = new DraftTracker()
    for (const ch of 'hello there') t.recordEdit(key(ch))
    expect(t.settle('hello there').pastedChars).toBe(0)
  })

  test('a no-key edit with text is a paste, counted by its length', () => {
    const t = new DraftTracker()
    t.recordEdit(paste(PASTE))
    expect(t.settle(`why does this fail? ${PASTE}`).pastedChars).toBe(PASTE.length)
  })

  test('deletions and cursor moves (no text) are ignored', () => {
    const t = new DraftTracker()
    t.recordEdit(paste(''))
    expect(t.settle('anything').pastedChars).toBe(0)
  })

  test('a paste that is no longer in the submitted text does not count', () => {
    const t = new DraftTracker()
    t.recordEdit(paste(PASTE))
    expect(t.settle('a different, fresh prompt altogether').pastedChars).toBe(0)
  })

  test('several pastes add up', () => {
    const t = new DraftTracker()
    const other = 'second pasted block with its own distinct opening words here'
    t.recordEdit(paste(PASTE))
    t.recordEdit(paste(other))
    expect(t.settle(`${PASTE}\n${other}`).pastedChars).toBe(PASTE.length + other.length)
  })
})

describe('dictation', () => {
  test('engine writes mark the prompt as dictated, even when typing was mixed in', () => {
    const t = new DraftTracker()
    t.recordEngineWrite()
    t.recordEngineWrite()
    t.recordEdit(key('x'))
    expect(t.settle('some text').isDictated).toBe(true)
  })

  test('typing alone is not dictation', () => {
    const t = new DraftTracker()
    t.recordEdit(key('a'))
    expect(t.settle('a').isDictated).toBe(false)
  })
})

describe('the box is emptied just before the submit', () => {
  test('a clear then the submit still sees the draft that was just closed', () => {
    const t = new DraftTracker()
    t.recordEngineWrite()
    t.recordEdit(paste(PASTE))
    t.recordClear()
    expect(t.settle(PASTE)).toEqual({ pastedChars: PASTE.length, isDictated: true })
  })

  test('a discarded draft does not leak into the next prompt', () => {
    const t = new DraftTracker()
    t.recordEngineWrite() // dictated, then discarded (clear, no submit)
    t.recordClear()
    t.recordEdit(key('h')) // the next prompt is typed
    t.recordEdit(key('i'))
    t.recordClear() // submitted
    expect(t.settle('hi')).toEqual({ pastedChars: 0, isDictated: false })
  })

  test('settle starts the tracker fresh', () => {
    const t = new DraftTracker()
    t.recordEngineWrite()
    t.recordClear()
    t.settle('x')
    expect(t.settle('y').isDictated).toBe(false)
  })
})

describe('resolveSource', () => {
  test('auto follows how the text arrived', () => {
    expect(resolveSource('auto', true)).toBe('voice')
    expect(resolveSource('auto', false)).toBe('typed')
  })
  test('a pinned mode wins, for third-party dictation tools', () => {
    expect(resolveSource('voice', false)).toBe('voice')
    expect(resolveSource('typed', true)).toBe('typed')
  })
})

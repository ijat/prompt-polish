import { describe, expect, test } from 'claude-code/testing'

import { AgentNoteTracker, agentNote } from './agentnote'
import { DEFAULTS } from './settings'

describe('agentNote', () => {
  test('names the log file and says it holds no prompt text', () => {
    const note = agentNote(DEFAULTS, '/Users/x/.claude/prompt-polish.log')
    expect(note).toContain('/Users/x/.claude/prompt-polish.log')
    expect(note).toContain('never contains prompt text')
    expect(note).toContain('If they ask whether it is working')
  })
  test('when the log is off, it tells the agent it cannot tell and what to suggest', () => {
    const note = agentNote({ ...DEFAULTS, isLogging: false }, '/Users/x/.claude/prompt-polish.log')
    expect(note).not.toContain('/Users/x')
    expect(note).toContain('isLogging')
  })
  test('with no home folder there is no path to give', () => {
    expect(agentNote(DEFAULTS, null)).toContain('isLogging')
  })
  test('it stays short, because it rides along in the system prompt', () => {
    expect(agentNote(DEFAULTS, '/Users/x/.claude/prompt-polish.log').length < 700).toBe(true)
  })
})

describe('AgentNoteTracker', () => {
  test('when the system-prompt route ran, the fallback never fires', () => {
    const t = new AgentNoteTracker()
    t.recordSubmit()
    t.markComposed()
    t.recordSubmit()
    t.recordSubmit()
    expect(t.takeFallback()).toBe(false)
  })
  test('when it never ran, the fallback fires once, on the second prompt', () => {
    const t = new AgentNoteTracker()
    t.recordSubmit()
    expect(t.takeFallback()).toBe(false)
    t.recordSubmit()
    expect(t.takeFallback()).toBe(true)
    t.recordSubmit()
    expect(t.takeFallback()).toBe(false)
  })
  test('the first prompt never gets it, since the system prompt is built after the submit', () => {
    const t = new AgentNoteTracker()
    t.recordSubmit()
    expect(t.takeFallback()).toBe(false)
  })
})

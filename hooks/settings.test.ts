import { describe, expect, test } from 'claude-code/testing'

import { DEFAULTS, readSettings } from './settings'

describe('readSettings', () => {
  test('empty options give the defaults', () => {
    expect(readSettings({})).toEqual(DEFAULTS)
    expect(readSettings()).toEqual(DEFAULTS)
  })
  test('valid values win', () => {
    const s = readSettings({ fastModel: 'sonnet', minWords: 6, minPastedChars: 50, isEnabled: false, improveEffort: 'high' })
    expect(s).toEqual({ ...DEFAULTS, fastModel: 'sonnet', minWords: 6, minPastedChars: 50, isEnabled: false, improveEffort: 'high' })
  })
  test('sourceMode accepts auto, voice and typed, and falls back to auto', () => {
    expect(readSettings({ sourceMode: 'voice' }).sourceMode).toBe('voice')
    expect(readSettings({ sourceMode: 'typed' }).sourceMode).toBe('typed')
    expect(readSettings({ sourceMode: 'loud' }).sourceMode).toBe('auto')
  })
  test('zero is a valid ask threshold (never ask)', () => {
    expect(readSettings({ askBelowConfidence: 0 }).askBelowConfidence).toBe(0)
    expect(readSettings({ askBelowConfidence: -1 }).askBelowConfidence).toBe(DEFAULTS.askBelowConfidence)
  })
  test('malformed values fall back to the default', () => {
    const s = readSettings({ fastEffort: 'bogus', maxWords: -3, statusSeconds: 'soon', fastModel: '', isEnabled: 'yes' })
    expect(s).toEqual(DEFAULTS)
  })
})

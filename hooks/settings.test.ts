import { describe, expect, test } from 'claude-code/testing'

import { DEFAULTS, readSettings, showsDetails, showsStatus } from './settings'

describe('readSettings', () => {
  test('empty options give the defaults', () => {
    expect(readSettings({})).toEqual(DEFAULTS)
    expect(readSettings()).toEqual(DEFAULTS)
  })
  test('attaching the original is off unless the person turns it on', () => {
    expect(readSettings({}).isAttachingOriginal).toBe(false)
    expect(readSettings({ isAttachingOriginal: true }).isAttachingOriginal).toBe(true)
    expect(readSettings({ isAttachingOriginal: 'yes' }).isAttachingOriginal).toBe(false)
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

describe('display and agent note settings', () => {
  test('the display is off by default and accepts off, status and full', () => {
    expect(readSettings({}).display).toBe('off')
    expect(readSettings({ display: 'status' }).display).toBe('status')
    expect(readSettings({ display: 'full' }).display).toBe('full')
    expect(readSettings({ display: 'loud' }).display).toBe('off')
  })
  test('what each display shows', () => {
    expect([showsStatus('off'), showsStatus('status'), showsStatus('full')]).toEqual([false, true, true])
    expect([showsDetails('off'), showsDetails('status'), showsDetails('full')]).toEqual([false, false, true])
  })
  test('telling the agent is on by default and can be turned off', () => {
    expect(readSettings({}).isTellingAgent).toBe(true)
    expect(readSettings({ isTellingAgent: false }).isTellingAgent).toBe(false)
  })
})

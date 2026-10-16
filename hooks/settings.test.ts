import { describe, expect, test } from 'claude-code/testing'

import { DEFAULTS, readSettings } from './settings'

describe('readSettings', () => {
  test('empty options give the defaults', () => {
    expect(readSettings({})).toEqual(DEFAULTS)
    expect(readSettings()).toEqual(DEFAULTS)
  })
  test('valid values win', () => {
    const s = readSettings({ fastModel: 'sonnet', minWords: 6, isEnabled: false, improveEffort: 'high' })
    expect(s).toEqual({ ...DEFAULTS, fastModel: 'sonnet', minWords: 6, isEnabled: false, improveEffort: 'high' })
  })
  test('malformed values fall back to the default', () => {
    const s = readSettings({ fastEffort: 'bogus', maxWords: -3, statusSeconds: 'soon', fastModel: '', isEnabled: 'yes' })
    expect(s).toEqual(DEFAULTS)
  })
})

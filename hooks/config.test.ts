import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_BYPASS, parsePolishConfig } from './config'

describe('parsePolishConfig: bypass', () => {
  test('no file, or a file without a bypass section, gives the defaults: phrases on, model check off', () => {
    expect(parsePolishConfig(null).bypass).toEqual(DEFAULT_BYPASS)
    expect(parsePolishConfig('{}').bypass).toEqual(DEFAULT_BYPASS)
    expect(DEFAULT_BYPASS).toEqual({ isEnabled: true, extraPhrases: [], isModelChecking: false })
  })
  test('the model check is on only when modelCheck is exactly true', () => {
    expect(parsePolishConfig('{"bypass":{"modelCheck":true}}').bypass.isModelChecking).toBe(true)
    for (const bad of ['"yes"', '1', 'null', '"true"']) {
      expect(parsePolishConfig(`{"bypass":{"modelCheck":${bad}}}`).bypass.isModelChecking).toBe(false)
    }
  })
  test('phrase bypass can be switched off, but only by an explicit false', () => {
    expect(parsePolishConfig('{"bypass":{"enabled":false}}').bypass.isEnabled).toBe(false)
    expect(parsePolishConfig('{"bypass":{"enabled":"no"}}').bypass.isEnabled).toBe(true)
  })
  test('extra phrases are kept when they are plain words, lowercased and de-duplicated; anything else is dropped', () => {
    const r = parsePolishConfig('{"bypass":{"phrases":["Verbatim","verbatim","as is","a.*","x|y", 5, "", "this is a very very very very long phrase indeed"]}}')
    expect(r.bypass.extraPhrases).toEqual(['verbatim', 'as is'])
  })
  test('invalid JSON gives the defaults', () => {
    const r = parsePolishConfig('{ nope')
    expect(r.bypass).toEqual(DEFAULT_BYPASS)
    expect(r.journal).toBe(null)
  })
  test('journal and bypass come from the same file independently', () => {
    const r = parsePolishConfig('{"journal":{"enabled":true,"level":"tips"},"bypass":{"modelCheck":true}}')
    expect(r.journal?.level).toBe('tips')
    expect(r.bypass.isModelChecking).toBe(true)
  })
})

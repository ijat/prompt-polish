import { describe, expect, test } from 'claude-code/testing'

import { appendedJsonl, configPath, expandHome, isInsideRepo, journalDirectory, monthFile, parseJournalConfig, toStored } from './journal'
import type { JournalEntry } from './journal'

const SECRET_SAID = 'rotate the production database password for project falcon'
const SECRET_FIXED = 'Rotate the production database password for Project Falcon.'
const SECRET_TIP = 'Capitalize proper names like Project Falcon.'

const entry: JournalEntry = {
  nowMs: Date.UTC(2026, 9, 16, 5, 0, 0),
  source: 'voice',
  action: 'grammar',
  confidence: 88,
  errors: ['capitalization', 'punctuation'],
  tip: SECRET_TIP,
  said: SECRET_SAID,
  fixed: SECRET_FIXED,
}

describe('parseJournalConfig', () => {
  test('no file means off, with no complaint', () => {
    expect(parseJournalConfig(null)).toEqual({ config: null, problem: null })
  })
  test('it is on only when enabled is exactly true', () => {
    expect(parseJournalConfig('{"journal":{"enabled":true}}').config).toEqual({ level: 'tags', directory: '' })
    for (const bad of ['{"journal":{"enabled":"yes"}}', '{"journal":{"enabled":1}}', '{"journal":{}}', '{}', 'null', '[]']) {
      expect(parseJournalConfig(bad).config).toBe(null)
    }
  })
  test('the level and directory are read; an unknown level falls back to the least revealing', () => {
    expect(parseJournalConfig('{"journal":{"enabled":true,"level":"sentences","directory":"~/notes/pp"}}').config).toEqual({ level: 'sentences', directory: '~/notes/pp' })
    expect(parseJournalConfig('{"journal":{"enabled":true,"level":"everything"}}').config?.level).toBe('tags')
  })
  test('invalid JSON keeps the journal off and says why', () => {
    const r = parseJournalConfig('{ not json')
    expect(r.config).toBe(null)
    expect(r.problem).toContain('not valid JSON')
  })
})

describe('toStored: what each level lets onto disk', () => {
  test('tags: no text of the person survives', () => {
    const json = JSON.stringify(toStored(entry, 'tags'))
    for (const leaked of [SECRET_SAID, SECRET_FIXED, SECRET_TIP, 'falcon', 'Falcon', 'password']) expect(json).not.toContain(leaked)
    expect(toStored(entry, 'tags').errors).toEqual(['capitalization', 'punctuation'])
    expect(toStored(entry, 'tags').ts).toBe('2026-10-16T05:00:00.000Z')
  })
  test('tips: the tip, but still not the sentences', () => {
    const stored = toStored(entry, 'tips')
    expect(stored.tip).toBe(SECRET_TIP)
    expect(stored.said).toBe(undefined)
    expect(stored.fixed).toBe(undefined)
  })
  test('sentences: everything', () => {
    const stored = toStored(entry, 'sentences')
    expect(stored.said).toBe(SECRET_SAID)
    expect(stored.fixed).toBe(SECRET_FIXED)
    expect(stored.tip).toBe(SECRET_TIP)
  })
  test('a "none" tip is not stored', () => {
    expect(toStored({ ...entry, tip: 'none' }, 'tips').tip).toBe(undefined)
  })
  test('control characters are stripped from stored text', () => {
    expect(toStored({ ...entry, said: 'a\u0007b\uFFFDc' }, 'sentences').said).toBe('abc')
  })
})

describe('paths', () => {
  test('the config file and default directory sit under the home folder', () => {
    expect(configPath('/Users/x')).toBe('/Users/x/.claude/prompt-polish.config.json')
    expect(configPath('/Users/x/')).toBe('/Users/x/.claude/prompt-polish.config.json')
    expect(configPath(undefined)).toBe(null)
    expect(journalDirectory({ level: 'tags', directory: '' }, '/Users/x')).toBe('/Users/x/.claude/prompt-polish-journal')
    expect(journalDirectory({ level: 'tags', directory: '' }, undefined)).toBe(null)
  })
  test('a configured directory may start with ~', () => {
    expect(expandHome('~/notes/pp', '/Users/x')).toBe('/Users/x/notes/pp')
    expect(expandHome('/abs/dir', '/Users/x')).toBe('/abs/dir')
    expect(journalDirectory({ level: 'tags', directory: '~/pp' }, '/Users/x')).toBe('/Users/x/pp')
  })
  test('one file per month, in UTC', () => {
    expect(monthFile('/d/', Date.UTC(2026, 0, 31, 23, 59))).toBe('/d/2026-01.jsonl')
    expect(monthFile('/d', Date.UTC(2026, 9, 16))).toBe('/d/2026-10.jsonl')
  })
})

describe('appendedJsonl', () => {
  test('adds one JSON line, keeping earlier ones', () => {
    const first = appendedJsonl('', toStored(entry, 'tags'))
    const second = appendedJsonl(first, toStored({ ...entry, action: 'clean' }, 'tags'))
    const lines = second.trim().split('\n')
    expect(lines.length).toBe(2)
    expect(JSON.parse(lines[1] ?? '{}').action).toBe('clean')
  })
  test('repairs a file that lost its final newline', () => {
    expect(appendedJsonl('{"a":1}', toStored(entry, 'tags')).split('\n').length).toBe(3)
  })
})

describe('isInsideRepo: the journal must never land where it could be committed', () => {
  const repos = (...roots: string[]) => async (path: string) => roots.some(r => path === `${r}/.git`)
  test('a folder in a repository is refused, however deep', async () => {
    expect(await isInsideRepo('/work/proj/notes/journal', repos('/work/proj'))).toBe(true)
    expect(await isInsideRepo('/work/proj', repos('/work/proj'))).toBe(true)
  })
  test('a folder outside any repository is allowed', async () => {
    expect(await isInsideRepo('/Users/x/.claude/prompt-polish-journal', repos('/work/proj'))).toBe(false)
  })
  test('the home folder being a repository refuses everything under it', async () => {
    expect(await isInsideRepo('/Users/x/.claude/prompt-polish-journal', repos('/Users/x'))).toBe(true)
  })
  test('Windows-style paths are walked too', async () => {
    const exists = async (p: string) => p === 'C:\\work\\proj/.git'
    expect(await isInsideRepo('C:\\work\\proj\\notes', exists)).toBe(true)
  })
})

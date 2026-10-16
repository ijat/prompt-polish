import { describe, expect, test } from 'claude-code/testing'

import { parsePolishConfig } from './config'
import { DEFAULT_VOCABULARY, MAX_TERMS, joinSplitNames, mergeTerms, parseVocabulary, projectNames, vocabularyNote } from './vocab'

const terms = (...names: string[]) => names.map(name => ({ name, isAutoFixing: true }))

describe('parseVocabulary', () => {
  test('no section gives no names and project names on', () => {
    expect(parsePolishConfig(null).vocabulary).toEqual(DEFAULT_VOCABULARY)
    expect(parsePolishConfig('{}').vocabulary).toEqual(DEFAULT_VOCABULARY)
    expect(DEFAULT_VOCABULARY).toEqual({ terms: [], isAddingProject: true })
  })
  test('reads plain names and objects; autofix off only by an explicit false', () => {
    const v = parseVocabulary({ vocabulary: { names: ['socialman', { name: 'LuneTube' }, { name: 'tazzii', autofix: false }] } })
    expect(v.terms).toEqual([
      { name: 'socialman', isAutoFixing: true },
      { name: 'LuneTube', isAutoFixing: true },
      { name: 'tazzii', isAutoFixing: false },
    ])
  })
  test('drops unsafe or junk entries and duplicates (case-insensitive)', () => {
    const v = parseVocabulary({ vocabulary: { names: ['ok-name', 'two words', '', 42, null, '<b>x</b>', 'OK-NAME', 'x'] } })
    expect(v.terms.map(t => t.name)).toEqual(['ok-name'])
  })
  test('only short single tokens of letters and digits are joined back', () => {
    const v = parseVocabulary({ vocabulary: { names: ['api', 'prompt-polish', 'socialman'] } })
    expect(v.terms.map(t => t.isAutoFixing)).toEqual([false, false, true])
  })
  test('project names can be switched off, but only by an explicit false', () => {
    expect(parseVocabulary({ vocabulary: { project: false } }).isAddingProject).toBe(false)
    expect(parseVocabulary({ vocabulary: { project: 'no' } }).isAddingProject).toBe(true)
  })
})

describe('projectNames', () => {
  test('folder, package name without scope, and git remote repo', () => {
    const git = '[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:ijat/socialman.git\n\tfetch = +refs/heads/*'
    expect(projectNames({ folder: '/Users/x/Projects/socials/', packageJson: '{"name":"@acme/social-web"}', gitConfig: git })).toEqual([
      'socials',
      'social-web',
      'socialman',
    ])
  })
  test('missing or broken sources name nothing, and dot-folders are skipped', () => {
    expect(projectNames({ folder: '/Users/x/.claude', packageJson: '{oops', gitConfig: null })).toEqual([])
    expect(projectNames({})).toEqual([])
  })
})

describe('mergeTerms', () => {
  test('own names win over project names, capped', () => {
    const merged = mergeTerms([{ name: 'SocialMan', isAutoFixing: false }], ['socialman', 'tazzii'])
    expect(merged).toEqual([
      { name: 'SocialMan', isAutoFixing: false },
      { name: 'tazzii', isAutoFixing: true },
    ])
    expect(mergeTerms([], Array.from({ length: 50 }, (_, i) => `name${i}x`)).length).toBe(MAX_TERMS)
  })
})

describe('vocabularyNote', () => {
  test('empty without names; lists them otherwise', () => {
    expect(vocabularyNote([])).toBe('')
    expect(vocabularyNote(terms('socialman', 'LuneTube'))).toContain(': socialman, LuneTube.')
  })
})

describe('joinSplitNames', () => {
  const t = terms('socialman', 'LuneTube')
  test('joins spaced and hyphenated splits, any case, to the listed spelling', () => {
    expect(joinSplitNames('fix the social man login', t)).toBe('fix the socialman login')
    expect(joinSplitNames('Social Man and lune tube.', t)).toBe('socialman and LuneTube.')
    expect(joinSplitNames('the social-man repo, ok?', t)).toBe('the socialman repo, ok?')
  })
  test('leaves text that already has the name, or only resembles it', () => {
    for (const s of ['open Socialman', 'a social manager', 'social men', 'antisocial man', 'socialman']) {
      expect(joinSplitNames(s, t)).toBe(s)
    }
  })
  test('leaves paths, file names and identifiers alone', () => {
    for (const s of ['edit social-man.ts', 'cd src/social man', 'my_social man', 'social man/index']) {
      expect(joinSplitNames(s, t)).toBe(s)
    }
  })
  test('skips names with autofix off', () => {
    expect(joinSplitNames('social man', [{ name: 'socialman', isAutoFixing: false }])).toBe('social man')
  })
})

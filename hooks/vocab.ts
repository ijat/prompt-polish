/**
 * The person's own names (projects, tools, terms) that dictation and the model would otherwise split or
 * "correct" into ordinary words, such as "socialman" heard as "social man". Pure: no engine access.
 */

export type Term = {
  /** The name exactly as it should be written. */
  name: string
  /** Join the name back when the rewrite splits it with spaces or hyphens ("social man" -> "socialman"). */
  isAutoFixing: boolean
}

export type VocabularyConfig = {
  terms: readonly Term[]
  /** Also add the current project's name (folder, package.json, git remote). On by default. */
  isAddingProject: boolean
}

export const DEFAULT_VOCABULARY: VocabularyConfig = { terms: [], isAddingProject: true }

/** At most this many names go into the model's prompt. */
export const MAX_TERMS = 30

/** A name is a short token of letters, digits, dot, dash or underscore, starting with a letter or digit. */
const NAME = /^[\p{L}\p{N}][\p{L}\p{N}._-]{1,39}$/u

/** Only a single run of letters and digits this long can be joined back safely. */
const MIN_AUTOFIX_LENGTH = 5
const isJoinable = (name: string): boolean => name.length >= MIN_AUTOFIX_LENGTH && /^[\p{L}\p{N}]+$/u.test(name)

const toTerm = (raw: unknown): Term | null => {
  if (typeof raw === 'string') {
    const name = raw.trim()
    return NAME.test(name) ? { name, isAutoFixing: isJoinable(name) } : null
  }
  if (raw === null || typeof raw !== 'object') return null
  const { name: n, autofix } = raw as { name?: unknown; autofix?: unknown }
  if (typeof n !== 'string' || !NAME.test(n.trim())) return null
  const name = n.trim()
  return { name, isAutoFixing: autofix !== false && isJoinable(name) }
}

/** The config file's `vocabulary` section: `{ "names": ["socialman", { "name": "Foo", "autofix": false }], "project": true }`. */
export const parseVocabulary = (raw: unknown): VocabularyConfig => {
  const v = (raw as { vocabulary?: unknown } | null)?.vocabulary as { names?: unknown; project?: unknown } | undefined | null
  if (v === undefined || v === null || typeof v !== 'object') return DEFAULT_VOCABULARY
  const terms = Array.isArray(v.names) ? v.names.map(toTerm).filter((t): t is Term => t !== null) : []
  return { terms: dedupe(terms), isAddingProject: v.project === false ? false : true }
}

/** First spelling of a name wins, compared case-insensitively. */
const dedupe = (terms: readonly Term[]): Term[] => {
  const seen = new Set<string>()
  return terms.filter(t => {
    const key = t.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** What the project around the session is called, from the places that name it. Each source is optional. */
export const projectNames = (sources: { folder?: string; packageJson?: string | null; gitConfig?: string | null }): string[] => {
  const names: string[] = []
  const folder = sources.folder?.replace(/[\\/]+$/, '').split(/[\\/]/).pop()
  if (folder) names.push(folder)
  if (sources.packageJson) {
    try {
      const pkg = (JSON.parse(sources.packageJson) as { name?: unknown }).name
      if (typeof pkg === 'string') names.push(pkg.replace(/^@[^/]+\//, ''))
    } catch {
      // A broken package.json just names nothing.
    }
  }
  const origin = sources.gitConfig?.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/)?.[1]
  const repo = origin?.replace(/\.git$/, '').split(/[/:]/).pop()
  if (repo) names.push(repo)
  return names.filter(n => NAME.test(n))
}

/** The person's own names first, then the project's, capped. */
export const mergeTerms = (own: readonly Term[], project: readonly string[]): Term[] =>
  dedupe([...own, ...project.map(name => ({ name, isAutoFixing: isJoinable(name) }))]).slice(0, MAX_TERMS)

/** The extra system-prompt lines that tell the model about the names; empty when there are none. */
export const vocabularyNote = (terms: readonly Term[]): string =>
  terms.length === 0
    ? ''
    : `\nKnown names: the speaker's own projects, tools and terms. Write each exactly as listed whenever the prompt refers to it, even when it was split into ordinary words or sounds like a common phrase (for example "social man" for "socialman"): ${terms.map(t => t.name).join(', ')}.`

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Joins a listed name back together where the rewrite split it with spaces or hyphens ("Social Man",
 * "social-man" -> "socialman"). Skips matches that touch path or identifier characters, so `social-man.ts`
 * or `src/social man` stay as written; a sentence's full stop is fine. Returns the text unchanged when nothing matched.
 */
export const joinSplitNames = (text: string, terms: readonly Term[]): string => {
  let out = text
  for (const t of terms) {
    if (!t.isAutoFixing) continue
    const letters = [...t.name].map(escape)
    // At least one separator must be present, or the text already has the name (case aside) and is left alone.
    const split = new RegExp(`(?<![\\p{L}\\p{N}_./\\\\-])${letters.join('(?:[ \\t]+|-)?')}(?![\\p{L}\\p{N}_/\\\\-]|\\.[\\p{L}\\p{N}])`, 'giu')
    out = out.replace(split, match => (/[ \t-]/.test(match) ? t.name : match))
  }
  return out
}

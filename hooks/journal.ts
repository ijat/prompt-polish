import type { Source } from './provenance'
import type { ErrorCode } from './protocol'
import { clean, hasTip } from './protocol'

/**
 * The learning journal: an opt-in, local-only record of what the mod fixed, for studying your own English.
 * It is controlled by a configuration file the person writes (`~/.claude/prompt-polish.config.json`),
 * never by plugin settings, and it is written only to a directory outside any git repository.
 */

/** How much the journal may hold. Each level includes the one before it. */
export type JournalLevel = 'tags' | 'tips' | 'sentences'

const LEVELS: readonly JournalLevel[] = ['tags', 'tips', 'sentences']

export type JournalConfig = {
  level: JournalLevel
  /** Where the monthly files go; empty means the default directory under the home folder. */
  directory: string
}

/** The config file's name, inside `~/.claude`. */
export const CONFIG_FILE_NAME = '.claude/prompt-polish.config.json'

export const DEFAULT_JOURNAL_DIRECTORY = '.claude/prompt-polish-journal'

/** What happened to one prompt, as the flow knows it. The text fields exist only in memory until `toStored` decides. */
export type JournalEntry = {
  nowMs: number
  source: Source
  /** `clean` means the model ran and found nothing to fix. */
  action: 'grammar' | 'improve' | 'clean'
  confidence: number
  errors: readonly ErrorCode[]
  tip: string
  said: string
  fixed: string
}

/** What is written to disk. Keys beyond the first group appear only when the level allows. */
export type StoredEntry = {
  v: 1
  ts: string
  source: Source
  action: JournalEntry['action']
  confidence: number
  errors: readonly ErrorCode[]
  tip?: string
  said?: string
  fixed?: string
}

export type ConfigResult = { config: JournalConfig | null; problem: string | null }

const off = (problem: string | null = null): ConfigResult => ({ config: null, problem })

/**
 * Reads the config file's text. The journal is on only when `journal.enabled` is exactly `true`;
 * a missing, unreadable or malformed file keeps it off. An unknown level falls back to the least revealing one.
 */
export const parseJournalConfig = (text: string | null): ConfigResult => {
  if (text === null) return off()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return off('the config file is not valid JSON, so the journal stays off')
  }
  const journal = (raw as { journal?: unknown } | null)?.journal as { enabled?: unknown; level?: unknown; directory?: unknown } | undefined
  if (journal === undefined || journal === null || journal.enabled !== true) return off()
  const level = LEVELS.find(l => l === journal.level) ?? 'tags'
  const directory = typeof journal.directory === 'string' ? journal.directory.trim() : ''
  return { config: { level, directory }, problem: null }
}

/** Keeps only what the level allows. At `tags`, no text of the person's survives. */
export const toStored = (entry: JournalEntry, level: JournalLevel): StoredEntry => {
  const stored: StoredEntry = {
    v: 1,
    ts: new Date(entry.nowMs).toISOString(),
    source: entry.source,
    action: entry.action,
    confidence: entry.confidence,
    errors: entry.errors,
  }
  if (level === 'tags') return stored
  if (hasTip(entry.tip)) stored.tip = clean(entry.tip)
  if (level === 'tips') return stored
  stored.said = clean(entry.said)
  stored.fixed = clean(entry.fixed)
  return stored
}

/** `~` or `~/` at the start of a path means the home folder. */
export const expandHome = (path: string, home: string): string => {
  const base = home.replace(/[\\/]+$/, '')
  if (path === '~') return base
  return path.startsWith('~/') || path.startsWith('~\\') ? `${base}/${path.slice(2)}` : path
}

/** Where the config file lives, or null when no home folder is known. */
export const configPath = (home: string | undefined): string | null => (home ? `${home.replace(/[\\/]+$/, '')}/${CONFIG_FILE_NAME}` : null)

/** The directory the journal goes in, or null when there is neither a configured directory nor a home folder. */
export const journalDirectory = (config: JournalConfig, home: string | undefined): string | null => {
  if (config.directory !== '') return home ? expandHome(config.directory, home) : config.directory
  return home ? `${home.replace(/[\\/]+$/, '')}/${DEFAULT_JOURNAL_DIRECTORY}` : null
}

/** One file per month keeps each file small enough to read and rewrite. */
export const monthFile = (directory: string, nowMs: number): string => {
  const d = new Date(nowMs)
  const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `${directory.replace(/[\\/]+$/, '')}/${month}.jsonl`
}

/** The file's new content with one more record on its own line. */
export const appendedJsonl = (existing: string, record: StoredEntry): string => {
  const base = existing === '' || existing.endsWith('\n') ? existing : `${existing}\n`
  return `${base}${JSON.stringify(record)}\n`
}

const parentOf = (path: string): string | null => {
  const trimmed = path.replace(/[\\/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return cut > 0 ? trimmed.slice(0, cut) : null
}

/**
 * True when `directory`, or any folder above it, holds a `.git`: the journal must never land in a
 * repository where it could be committed. `exists` is the file-system check, injected for tests.
 */
export const isInsideRepo = async (directory: string, exists: (path: string) => Promise<boolean>): Promise<boolean> => {
  let current: string | null = directory.replace(/[\\/]+$/, '')
  while (current !== null && current !== '') {
    if (await exists(`${current}/.git`)) return true
    current = parentOf(current)
  }
  return false
}

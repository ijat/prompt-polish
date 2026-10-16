import type { JournalConfig } from './journal'
import { parseJournalConfig } from './journal'

/**
 * The person's own configuration file, `~/.claude/prompt-polish.config.json`. It holds what is personal or
 * sensitive: the learning journal and the bypass rules. It is read on every prompt, so edits apply at once,
 * and it lives outside this repository (which ignores it).
 */

export type BypassConfig = {
  /** The phrase rules (`bypass:` and friends) are active. On by default. */
  isEnabled: boolean
  /** Extra opening words that mean "leave this alone", each followed by `:` `.` `-` or `—`. */
  extraPhrases: readonly string[]
  /**
   * Let the model also decide, from the sentence, whether the person asked for the prompt to be left alone.
   * Off unless the person sets it to exactly `true`.
   */
  isModelChecking: boolean
}

export const DEFAULT_BYPASS: BypassConfig = { isEnabled: true, extraPhrases: [], isModelChecking: false }

export type PolishConfig = {
  journal: JournalConfig | null
  bypass: BypassConfig
  /** Why part of the file was ignored (invalid JSON), or null. */
  problem: string | null
}

/** A phrase is a short run of letters and spaces, so it can safely become part of a pattern. */
const isPhrase = (value: unknown): value is string => typeof value === 'string' && /^[\p{L}][\p{L} ]{0,30}$/u.test(value.trim())

const parseBypass = (raw: unknown): BypassConfig => {
  const b = (raw as { bypass?: unknown } | null)?.bypass as { enabled?: unknown; phrases?: unknown; modelCheck?: unknown } | undefined | null
  if (b === undefined || b === null || typeof b !== 'object') return DEFAULT_BYPASS
  const phrases = Array.isArray(b.phrases) ? b.phrases.filter(isPhrase).map(p => p.trim().toLowerCase()) : []
  return {
    isEnabled: b.enabled === false ? false : true,
    extraPhrases: [...new Set(phrases)],
    isModelChecking: b.modelCheck === true,
  }
}

/** Reads the config file's text. A missing file gives the defaults; invalid JSON gives the defaults and says why. */
export const parsePolishConfig = (text: string | null): PolishConfig => {
  const { config: journal, problem } = parseJournalConfig(text)
  if (text === null) return { journal, bypass: DEFAULT_BYPASS, problem }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { journal, bypass: DEFAULT_BYPASS, problem }
  }
  return { journal, bypass: parseBypass(raw), problem }
}

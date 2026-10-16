import type { SourceMode } from './provenance'

export type Effort = 'low' | 'medium' | 'high'

/** What the mod shows in the session: nothing, only the short status line, or the status plus the before/after and tip lines. */
export type Display = 'off' | 'status' | 'full'

export type Settings = {
  isEnabled: boolean
  fastModel: string
  fastEffort: Effort
  improveModel: string
  improveEffort: Effort
  isAskingWhenUnsure: boolean
  isAutoImproving: boolean
  display: Display
  /** Add a short note to the system prompt telling the agent where to look when asked whether the mod works. */
  isTellingAgent: boolean
  /** Attach your original text as a hidden note to the agent. Costs context tokens on every rewritten prompt. */
  isAttachingOriginal: boolean
  /** Write a diagnostics log (decisions and counts only, never prompt text). */
  isLogging: boolean
  /** `auto` tells voice from typing by how the text entered the box; the others pin it. */
  sourceMode: SourceMode
  /** Where the log goes; empty means `~/.claude/prompt-polish.log`. */
  logPath: string
  /** Ask only when the model's confidence (0-100) is below this. */
  askBelowConfidence: number
  minWords: number
  /** A prompt with at least this many pasted characters is left completely alone. */
  minPastedChars: number
  maxWords: number
  statusSeconds: number
}

export const DEFAULTS: Settings = {
  isEnabled: true,
  fastModel: 'haiku',
  fastEffort: 'low',
  improveModel: 'opus',
  improveEffort: 'medium',
  isAskingWhenUnsure: true,
  isAutoImproving: false,
  display: 'off',
  isTellingAgent: true,
  isAttachingOriginal: false,
  isLogging: true,
  sourceMode: 'auto',
  logPath: '',
  askBelowConfidence: 30,
  minWords: 4,
  minPastedChars: 20,
  maxWords: 250,
  statusSeconds: 8,
}

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high']

type Raw = Readonly<Record<string, unknown>>

const text = (raw: Raw, key: 'fastModel' | 'improveModel'): string => {
  const v = raw[key]
  return typeof v === 'string' && v !== '' ? v : DEFAULTS[key]
}

const optionalText = (raw: Raw, key: 'logPath'): string => {
  const v = raw[key]
  return typeof v === 'string' ? v.trim() : DEFAULTS[key]
}

const positive = (raw: Raw, key: 'minWords' | 'minPastedChars' | 'maxWords' | 'statusSeconds'): number => {
  const v = raw[key]
  return typeof v === 'number' && v > 0 ? v : DEFAULTS[key]
}

const nonNegative = (raw: Raw, key: 'askBelowConfidence'): number => {
  const v = raw[key]
  return typeof v === 'number' && v >= 0 ? v : DEFAULTS[key]
}

const flag = (raw: Raw, key: 'isEnabled' | 'isAskingWhenUnsure' | 'isAutoImproving' | 'isAttachingOriginal' | 'isLogging' | 'isTellingAgent'): boolean => {
  const v = raw[key]
  return typeof v === 'boolean' ? v : DEFAULTS[key]
}

const SOURCE_MODES: readonly SourceMode[] = ['auto', 'voice', 'typed']

const sourceMode = (raw: Raw): SourceMode => SOURCE_MODES.find(m => m === raw['sourceMode']) ?? DEFAULTS.sourceMode

const DISPLAYS: readonly Display[] = ['off', 'status', 'full']

const display = (raw: Raw): Display => DISPLAYS.find(d => d === raw['display']) ?? DEFAULTS.display

const effort = (raw: Raw, key: 'fastEffort' | 'improveEffort'): Effort => {
  const v = raw[key]
  return EFFORTS.find(e => e === v) ?? DEFAULTS[key]
}

/** Plugin options from settings; each falls back to its default when absent or malformed. */
export const readSettings = (raw: Raw = {}): Settings => ({
  isEnabled: flag(raw, 'isEnabled'),
  fastModel: text(raw, 'fastModel'),
  fastEffort: effort(raw, 'fastEffort'),
  improveModel: text(raw, 'improveModel'),
  improveEffort: effort(raw, 'improveEffort'),
  isAskingWhenUnsure: flag(raw, 'isAskingWhenUnsure'),
  isAutoImproving: flag(raw, 'isAutoImproving'),
  display: display(raw),
  isTellingAgent: flag(raw, 'isTellingAgent'),
  isAttachingOriginal: flag(raw, 'isAttachingOriginal'),
  isLogging: flag(raw, 'isLogging'),
  sourceMode: sourceMode(raw),
  logPath: optionalText(raw, 'logPath'),
  minWords: positive(raw, 'minWords'),
  minPastedChars: positive(raw, 'minPastedChars'),
  maxWords: positive(raw, 'maxWords'),
  askBelowConfidence: nonNegative(raw, 'askBelowConfidence'),
  statusSeconds: positive(raw, 'statusSeconds'),
})

/** The short status line is shown for `status` and `full`. */
export const showsStatus = (display: Display): boolean => display !== 'off'

/** The before/after and tip lines go to the transcript only for `full`; otherwise to the debug log. */
export const showsDetails = (display: Display): boolean => display === 'full'

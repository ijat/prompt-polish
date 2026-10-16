import type { Settings } from './settings'

/** The facts about a submitted prompt that the rewrite decision needs. */
export type Input = {
  text: string
  context?: readonly string[]
  isCommand: boolean
  isMeta: boolean
  originKind: string
  /** Characters of `text` that were pasted rather than typed or dictated. */
  pastedChars: number
}

/** Origins that are the person's own typing or dictation. */
const HUMAN_ORIGINS: readonly string[] = ['composer', 'bridge']

const LIST_MARKER = /(?:^|\s)(?:[-*•]|\d+[.)])\s/g
const IMPROVE_VERB = '(?:improve|polish|enhance|sharpen)'
const LEADING_REQUEST = new RegExp(`^\\s*(?:please\\s+)?${IMPROVE_VERB}(?:\\s+(?:this|my|the))?(?:\\s+prompt)?\\s*[:\\-\\u2014]\\s*`, 'i')
const TRAILING_REQUEST = new RegExp(`[\\s,.;]*(?:and\\s+)?(?:please\\s+)?${IMPROVE_VERB}\\s+(?:this|my|the)\\s+prompt[\\s.!]*$`, 'i')

export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length

/**
 * Dictation arrives as one flat paragraph; typed or pasted prompts show structure.
 * Returns the kind of structure found, or null for a flat paragraph.
 */
export const structure = (text: string, maxWords: number): string | null => {
  const body = text.trim()
  if (/\n/.test(body)) return 'multi-line'
  if (/```/.test(body)) return 'code block'
  if ((body.match(LIST_MARKER) ?? []).length >= 2) return 'list'
  if (countWords(body) > maxWords) return `over ${maxWords} words`
  return null
}

export type ImproveRequest = { isExplicit: boolean; text: string }

/**
 * An explicit request to improve: the prompt opens with `improve:` (or `polish this prompt -`)
 * or ends with "improve this prompt". `text` is the prompt with that phrase removed.
 */
export const explicitImprove = (text: string): ImproveRequest => {
  const stripped = text.replace(LEADING_REQUEST, '').replace(TRAILING_REQUEST, '').trim()
  return stripped !== '' && stripped !== text.trim() ? { isExplicit: true, text: stripped } : { isExplicit: false, text }
}

/**
 * Why this prompt must be left exactly as it is, or null when it is a candidate.
 * An explicit improve request is a candidate however structured the prompt is, but never when it holds pasted content.
 */
export const skipReason = (input: Input, cfg: Settings, isExplicit: boolean): string | null => {
  if (input.isCommand) return 'slash command'
  if (input.isMeta) return 'hidden prompt'
  if (!HUMAN_ORIGINS.includes(input.originKind)) return `origin ${input.originKind}`
  if (input.pastedChars >= cfg.minPastedChars) return 'pasted content'
  if (countWords(input.text) < cfg.minWords) return `under ${cfg.minWords} words`
  if (isExplicit) return null
  const found = structure(input.text, cfg.maxWords)
  return found ? `structured prompt: ${found}` : null
}

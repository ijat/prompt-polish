export type Effort = 'low' | 'medium' | 'high'

export type Settings = {
  isEnabled: boolean
  fastModel: string
  fastEffort: Effort
  improveModel: string
  improveEffort: Effort
  isAskingWhenUnsure: boolean
  isAutoImproving: boolean
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

const positive = (raw: Raw, key: 'minWords' | 'minPastedChars' | 'maxWords' | 'statusSeconds'): number => {
  const v = raw[key]
  return typeof v === 'number' && v > 0 ? v : DEFAULTS[key]
}

const nonNegative = (raw: Raw, key: 'askBelowConfidence'): number => {
  const v = raw[key]
  return typeof v === 'number' && v >= 0 ? v : DEFAULTS[key]
}

const flag = (raw: Raw, key: 'isEnabled' | 'isAskingWhenUnsure' | 'isAutoImproving'): boolean => {
  const v = raw[key]
  return typeof v === 'boolean' ? v : DEFAULTS[key]
}

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
  minWords: positive(raw, 'minWords'),
  minPastedChars: positive(raw, 'minPastedChars'),
  maxWords: positive(raw, 'maxWords'),
  askBelowConfidence: nonNegative(raw, 'askBelowConfidence'),
  statusSeconds: positive(raw, 'statusSeconds'),
})

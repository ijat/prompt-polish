/** How many leading characters of a paste are kept to recognise it in the submitted text. */
const HEAD_CHARS = 40

type PasteMark = { head: string; length: number }

/** What was observed while one draft was being composed. Kept in memory only, until the prompt is submitted. */
type Draft = { pastes: PasteMark[]; engineWrites: number }

const emptyDraft = (): Draft => ({ pastes: [], engineWrites: 0 })
const hasObservations = (d: Draft): boolean => d.pastes.length > 0 || d.engineWrites > 0

/** One edit in the prompt box, as the `prompt.edit` event reports it. */
export type EditFact = {
  /** True when a single key press made the edit; false for a paste or a folded burst of keys. */
  hasKey: boolean
  /** What the edit put in the box; empty for a deletion or a cursor move. */
  inputText: string
}

/** How the text of a prompt got into the box. */
export type Provenance = {
  /** Characters of the submitted text that were pasted. */
  pastedChars: number
  /** True when Claude Code itself wrote into the box (its built-in dictation): voice-only or mixed prompts. */
  isDictated: boolean
}

/** Whether a prompt gets the dictation cleanup or only the typing proofread. */
export type Source = 'voice' | 'typed'
export type SourceMode = 'auto' | 'voice' | 'typed'

/** `auto` follows how the text arrived; the other modes pin it (for example, when using a third-party dictation tool). */
export const resolveSource = (mode: SourceMode, isDictated: boolean): Source => (mode === 'auto' ? (isDictated ? 'voice' : 'typed') : mode)

/**
 * Remembers how the current draft was composed, so a submitted prompt can be told to contain pasted
 * content or dictation. Only a short head of each paste is kept; nothing is written anywhere.
 *
 * Claude Code empties the box (a `clear` change) just before it raises the submit, and also when a
 * draft is discarded. So a clear closes the draft in progress; at submit, the last closed draft is
 * used if the box holds nothing newer. A discarded draft is thereby replaced by the next one.
 */
export class DraftTracker {
  private current: Draft = emptyDraft()
  private closed: Draft = emptyDraft()

  recordEdit(edit: EditFact): void {
    if (edit.hasKey || edit.inputText === '') return
    this.current.pastes.push({ head: edit.inputText.slice(0, HEAD_CHARS), length: edit.inputText.length })
  }

  /** A write by Claude Code itself (dictation, a prefill, a restored draft). */
  recordEngineWrite(): void {
    this.current.engineWrites += 1
  }

  /** The box was emptied: the draft in progress is over, whether it was submitted or discarded. */
  recordClear(): void {
    if (hasObservations(this.current)) this.closed = this.current
    else this.closed = emptyDraft()
    this.current = emptyDraft()
  }

  /** How the submitted prompt was composed. Call once per submit, then the tracker starts fresh. */
  settle(submittedText: string): Provenance {
    const draft = hasObservations(this.current) ? this.current : this.closed
    this.current = emptyDraft()
    this.closed = emptyDraft()
    const pastedChars = draft.pastes.filter(m => submittedText.includes(m.head)).reduce((sum, m) => sum + m.length, 0)
    return { pastedChars, isDictated: draft.engineWrites > 0 }
  }
}

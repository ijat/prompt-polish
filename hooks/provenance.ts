/** How many leading characters of a paste are kept to recognise it in the submitted text. */
const HEAD_CHARS = 40

type PasteMark = { head: string; length: number }

/** One edit in the prompt box, as the `prompt.edit` event reports it. */
export type EditFact = {
  /** True when a single key press made the edit; false for a paste or a folded burst of keys. */
  hasKey: boolean
  /** What the edit put in the box; empty for a deletion or a cursor move. */
  inputText: string
}

/**
 * Remembers which edits of the current draft were not key presses (pastes), so a submitted prompt
 * can be told to contain pasted content. Only a short head of each paste is kept, in memory, and
 * only until the prompt is submitted; nothing is stored or logged.
 */
export class PasteTracker {
  private marks: PasteMark[] = []

  record(edit: EditFact): void {
    if (edit.hasKey || edit.inputText === '') return
    this.marks.push({ head: edit.inputText.slice(0, HEAD_CHARS), length: edit.inputText.length })
  }

  /**
   * Characters of the submitted text that came from pastes. A paste whose head is no longer in
   * the text (a discarded draft, or text edited away) is not counted.
   */
  pastedChars(submittedText: string): number {
    return this.marks.filter(m => submittedText.includes(m.head)).reduce((sum, m) => sum + m.length, 0)
  }

  reset(): void {
    this.marks = []
  }
}

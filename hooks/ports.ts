import type { ModelCompleteRequest, ModelCompleteResult } from 'claude-code'

import type { JournalEntry } from './journal'

/** What the decision logic needs from the engine. The hook wires the real `$`; tests wire fakes. */
export type Deps = {
  complete: (req: ModelCompleteRequest) => Promise<ModelCompleteResult>
  ask: (question: string, options: { options: readonly string[]; header: string }) => Promise<string>
  /** A transcript line. */
  log: (text: string) => void
  /** The short, self-clearing status. */
  flash: (text: string) => void
  /** A diagnostics line for the log file. Must never contain the person's prompt text or any rewrite of it. */
  record: (line: string) => void
  /**
   * One finished prompt for the opt-in learning journal. It carries the person's text; the adapter
   * writes it only when the person's config file allows, and only as much as the chosen level allows.
   */
  journal: (entry: JournalEntry) => void
}

import type { Deps } from './ports'
import { clean, hasTip } from './protocol'

/** Tells the person what the mod did, in the transcript and the status line. */
export class Reporter {
  constructor(private readonly deps: Pick<Deps, 'log' | 'flash' | 'record'>) {}

  /** A one-line event, in both places. */
  note(message: string): void {
    this.deps.flash(message)
    this.deps.log(`[polish] ${message}`)
    this.deps.record(message)
  }

  /** Status only, for a step still in progress. */
  progress(message: string): void {
    this.deps.flash(message)
  }

  /** A transcript hint that does not change the status. */
  hint(message: string): void {
    this.deps.log(`[polish] ${message}`)
    this.deps.record(`hint: ${message}`)
  }

  /** Diagnostics for the log file only; never shown. Callers pass facts about the prompt, never its text. */
  trace(message: string): void {
    this.deps.record(message)
  }

  /** The before/after of a rewrite, plus the tip when there is one. */
  rewrite(label: string, original: string, rewritten: string, tip: string): void {
    this.note(label)
    this.trace(`lengths: in=${original.length} out=${rewritten.length} chars, tip=${hasTip(tip) ? 'yes' : 'no'}`)
    this.deps.log(`  you said: ${clean(original)}`)
    this.deps.log(`  sent as:  ${clean(rewritten)}`)
    if (hasTip(tip)) this.deps.log(`  tip:      ${clean(tip)}`)
  }
}

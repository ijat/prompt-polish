import type { Deps } from './ports'
import { clean, hasTip } from './protocol'

/** Tells the person what the mod did, in the transcript and the status line. */
export class Reporter {
  constructor(private readonly deps: Pick<Deps, 'log' | 'flash'>) {}

  /** A one-line event, in both places. */
  note(message: string): void {
    this.deps.flash(message)
    this.deps.log(`[polish] ${message}`)
  }

  /** Status only, for a step still in progress. */
  progress(message: string): void {
    this.deps.flash(message)
  }

  /** A transcript hint that does not change the status. */
  hint(message: string): void {
    this.deps.log(`[polish] ${message}`)
  }

  /** The before/after of a rewrite, plus the tip when there is one. */
  rewrite(label: string, original: string, rewritten: string, tip: string): void {
    this.note(label)
    this.deps.log(`  you said: ${clean(original)}`)
    this.deps.log(`  sent as:  ${clean(rewritten)}`)
    if (hasTip(tip)) this.deps.log(`  tip:      ${clean(tip)}`)
  }
}

import type { Settings } from './settings'

/**
 * A short section for the agent's system prompt (added once per session, so it does not grow with the
 * conversation). With the display off the agent cannot see what the mod did; this tells it where to look
 * when the person asks whether the mod is working.
 */
export const agentNote = (cfg: Settings, logPath: string | null): string => {
  const intro = 'The user has the prompt-polish mod installed. It can clean up or rewrite their prompts before you see them (dictation slips, typos) and shows nothing in the session unless they turned its display on.'
  const ask = 'If they ask whether it is working, do not guess.'
  if (!cfg.isLogging || logPath === null) {
    return `${intro} ${ask} Its diagnostics log is turned off (setting isLogging), so say you cannot tell from here and suggest turning that on.`
  }
  return `${intro} ${ask} Read the last lines of ${logPath}: each line is a timestamp and one decision, such as "rewrote last prompt", "skipped (reason)", "bypass: ..." or "model failed (reason)". It never contains prompt text. A missing file or only old lines means the mod is not running or not logging.`
}

/**
 * Makes sure the agent hears about the mod exactly once per session, by whichever route works.
 * The system-prompt hook is preferred, but on a plugin installed where an organization manages
 * Claude Code it never runs. The system prompt is built after a prompt is submitted, so by the
 * second prompt we know: if it never ran, the same note goes once through the prompt's context.
 */
export class AgentNoteTracker {
  private hasComposed = false
  private hasSentByContext = false
  private submits = 0

  /** The system-prompt hook ran, so the note is already there. */
  markComposed(): void {
    this.hasComposed = true
  }

  /** Call once per submitted prompt. */
  recordSubmit(): void {
    this.submits += 1
  }

  /** True once, on the first prompt after the first turn, when the system-prompt route did not run. */
  takeFallback(): boolean {
    if (this.hasComposed || this.hasSentByContext || this.submits < 2) return false
    this.hasSentByContext = true
    return true
  }
}

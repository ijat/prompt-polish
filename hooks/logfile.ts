/** The log keeps this many lines; older ones are dropped. */
export const KEEP_LINES = 300

/** One log line is cut to this many characters, so an unexpectedly long error cannot bloat the file. */
export const MAX_LINE_CHARS = 300

export const DEFAULT_LOG_NAME = '.claude/prompt-polish.log'

/** Where the log goes: the configured path, else `~/.claude/prompt-polish.log` (null when no home directory is known). */
export const resolveLogPath = (configured: string, home: string | undefined): string | null => {
  if (configured !== '') return configured
  return home ? `${home.replace(/[\\/]+$/, '')}/${DEFAULT_LOG_NAME}` : null
}

/** The log's new content after adding `line` (with its timestamp) to the existing content, capped at KEEP_LINES. */
export const appendedLog = (existing: string, line: string, nowMs: number): string => {
  const stamped = `${new Date(nowMs).toISOString()} ${line.replace(/\s+/g, ' ').slice(0, MAX_LINE_CHARS)}`
  const lines = [...existing.split('\n').filter(Boolean), stamped]
  return lines.slice(-KEEP_LINES).join('\n') + '\n'
}

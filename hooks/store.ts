import type { EngineInterface } from 'claude-code'

import { appendedJsonl, configPath, isInsideRepo, journalDirectory, monthFile, parseJournalConfig, toStored } from './journal'
import type { JournalEntry } from './journal'
import { appendedLog, resolveLogPath } from './logfile'
import type { Settings } from './settings'

/** The two things the mod writes to disk, each guarded so a failure never disturbs a prompt. */

/** Adds one line to the log file; read-modify-write because the engine's fs has no append. Never throws. */
export async function writeLogLine($: EngineInterface, cfg: Settings, line: string): Promise<void> {
  try {
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    const path = resolveLogPath(cfg.logPath, home)
    if (path === null) return
    let existing = ''
    try {
      existing = await $.fs.read(path)
    } catch {
      existing = ''
    }
    await $.fs.write(path, appendedLog(existing, line, await $.clock.now()))
  } catch {
    // Logging must never disturb a prompt.
  }
}

/**
 * Writes one prompt to the learning journal, but only when the person's config file opts in, only as much
 * as its level allows, and never into a git repository. Never throws, and never writes to the diagnostics log
 * anything of the person's text.
 */
export async function writeJournal($: EngineInterface, cfg: Settings, entry: JournalEntry): Promise<void> {
  try {
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    const file = configPath(home)
    if (file === null) return
    let configText: string | null = null
    try {
      configText = await $.fs.read(file)
    } catch {
      configText = null
    }
    const { config } = parseJournalConfig(configText)
    if (config === null) return
    const directory = journalDirectory(config, home)
    if (directory === null) return
    if (await isInsideRepo(directory, path => $.fs.exists(path))) {
      await writeLogLine($, cfg, 'journal not written: its folder is inside a git repository; set "directory" in the config file')
      return
    }
    const target = monthFile(directory, entry.nowMs)
    let existing = ''
    try {
      existing = await $.fs.read(target)
    } catch {
      existing = ''
    }
    await $.fs.write(target, appendedJsonl(existing, toStored(entry, config.level)))
  } catch {
    // The journal must never disturb a prompt.
  }
}


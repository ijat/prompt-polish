import type { EngineInterface, Register } from 'claude-code'

import { polish } from './polish'
import { DraftTracker, resolveSource } from './provenance'
import type { Deps } from './ports'
import { readSettings, showsDetails, showsStatus } from './settings'
import { AgentNoteTracker } from './agentnote'
import { agentNoteFor, readPolishConfig, writeJournal, writeLogLine } from './store'
import type { Settings } from './settings'

/** Counts statuses shown, so a status clears itself only if no newer one replaced it. */
type StatusTicket = { latest: number }

/** Serialises log writes so concurrent lines cannot overwrite each other. */
type LogQueue = { chain: Promise<void> }

/** Binds the decision logic's ports to the engine. */
function bindEngine($: EngineInterface, cfg: Settings, ticket: StatusTicket, logs: LogQueue): Deps {
  return {
    complete: req => $.model.complete(req),
    ask: (question, o) => $.ui.ask(question, o),
    // With the display off or brief, the details go to the debug log only (nothing on screen).
    log: text => $.ui.log(text, showsDetails(cfg.display) ? undefined : { to: 'debug' }),
    record: line => {
      if (cfg.isLogging) logs.chain = logs.chain.then(() => writeLogLine($, cfg, line))
    },
    journal: entry => {
      logs.chain = logs.chain.then(() => writeJournal($, cfg, entry))
    },
    flash: text => {
      if (!showsStatus(cfg.display)) return
      const mine = ++ticket.latest
      $.ui.status(`polish: ${text}`)
      void $.clock.sleep(cfg.statusSeconds * 1000).then(() => {
        if (mine === ticket.latest) $.ui.status(undefined)
      })
    },
  }
}

export const register: Register = (on, options) => {
  const cfg = readSettings(options as Readonly<Record<string, unknown>>)
  const ticket: StatusTicket = { latest: 0 }
  const drafts = new DraftTracker()
  const agentNotes = new AgentNoteTracker()
  const logs: LogQueue = { chain: Promise.resolve() }

  on('prompt.edit', ($, e, next) => {
    drafts.recordEdit({ hasKey: e.key !== undefined, inputText: e.inputText })
    return next(e)
  })

  on('prompt.change', ($, e, next) => {
    if (e.origin.kind === 'engine') drafts.recordEngineWrite()
    else if (e.origin.kind === 'clear') drafts.recordClear()
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    agentNotes.markComposed()
    if (!cfg.isEnabled || !cfg.isTellingAgent) return composed
    const text = await agentNoteFor($, cfg)
    return { sections: [...composed.sections, { id: 'prompt-polish:about', text, scope: 'session' as const }] }
  })

  on('prompt.submit', async ($, e, next) => {
    const { pastedChars, isDictated } = drafts.settle(e.text)
    agentNotes.recordSubmit()
    if (!cfg.isEnabled) return next(e)
    const { bypass } = await readPolishConfig($)
    const out = await polish(
      bindEngine($, cfg, ticket, logs),
      cfg,
      {
        text: e.text,
        context: e.context,
        isCommand: e.command !== undefined,
        isMeta: e.isMeta === true,
        originKind: e.origin.kind,
        pastedChars,
        source: resolveSource(cfg.sourceMode, isDictated),
      },
      bypass,
    )
    await logs.chain
    const context = out?.context ?? e.context
    const note = cfg.isTellingAgent && agentNotes.takeFallback() ? await agentNoteFor($, cfg) : null
    const finalContext = note === null ? context : [...(context ?? []), note]
    return next({ ...e, text: out?.text ?? e.text, ...(finalContext === undefined ? {} : { context: finalContext }) })
  })
}

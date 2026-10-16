import type { EngineInterface, Register } from 'claude-code'

import { polish } from './polish'
import { PasteTracker } from './provenance'
import type { Deps } from './ports'
import { readSettings } from './settings'
import type { Settings } from './settings'

/** Counts statuses shown, so a status clears itself only if no newer one replaced it. */
type StatusTicket = { latest: number }

/** Binds the decision logic's ports to the engine. */
function bindEngine($: EngineInterface, cfg: Settings, ticket: StatusTicket): Deps {
  return {
    complete: req => $.model.complete(req),
    ask: (question, o) => $.ui.ask(question, o),
    log: text => $.ui.log(text),
    flash: text => {
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
  const pastes = new PasteTracker()

  on('prompt.edit', ($, e, next) => {
    pastes.record({ hasKey: e.key !== undefined, inputText: e.inputText })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const pastedChars = pastes.pastedChars(e.text)
    pastes.reset()
    if (!cfg.isEnabled) return next(e)
    const out = await polish(bindEngine($, cfg, ticket), cfg, {
      text: e.text,
      context: e.context,
      isCommand: e.command !== undefined,
      isMeta: e.isMeta === true,
      originKind: e.origin.kind,
      pastedChars,
    })
    return next(out ? { ...e, text: out.text, context: out.context } : e)
  })
}

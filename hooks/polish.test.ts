import type { ModelCompleteRequest, ModelCompleteResult } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { DEFAULTS } from './settings'
import type { Settings } from './settings'
import type { JournalEntry } from './journal'
import { polish } from './polish'
import type { Input } from './gate'

/** The nth recorded item; fails the test clearly instead of yielding undefined. */
const nth = <T>(items: readonly T[], n: number): T => {
  const item = items[n]
  if (item === undefined) throw new Error(`expected item ${n}, only ${items.length} recorded`)
  return item
}

const usage = { input_tokens: 1, output_tokens: 1 } as never

const reply = (text: string): ModelCompleteResult => ({ isAnswered: true, text, usage })
const fast = (action: string, confidence: number | string, rewrite: string, tip = 'none', errors = 'none') =>
  reply(`ACTION:\n${action}\nCONFIDENCE:\n${confidence}\nERRORS:\n${errors}\nREWRITE:\n${rewrite}\nTIP:\n${tip}`)
const improved = (rewrite: string, tip = 'Say what fails.') => reply(`REWRITE:\n${rewrite}\nTIP:\n${tip}`)

/** Fake engine: scripted model replies in order, a scripted dialog answer, and everything recorded. */
const rig = (replies: ModelCompleteResult[], answer: string | Error = 'Fix grammar only') => {
  const calls: ModelCompleteRequest[] = []
  const logs: string[] = []
  const records: string[] = []
  const entries: JournalEntry[] = []
  const asked: { question: string; options: readonly string[] }[] = []
  const queue = [...replies]
  return {
    calls,
    logs,
    records,
    entries,
    asked,
    deps: {
      complete: async (req: ModelCompleteRequest) => {
        calls.push(req)
        const r = queue.shift()
        if (!r) throw new Error('unexpected model call')
        return r
      },
      ask: async (question: string, o: { options: readonly string[]; header: string }) => {
        asked.push({ question, options: o.options })
        if (answer instanceof Error) throw answer
        return answer
      },
      log: (t: string) => void logs.push(t),
      flash: () => {},
      record: (t: string) => void records.push(t),
      journal: (e: JournalEntry) => void entries.push(e),
    },
  }
}

const voice = (text: string, extra: Partial<Input> = {}): Input => ({
  text,
  isCommand: false,
  isMeta: false,
  originKind: 'composer',
  pastedChars: 0,
  source: 'voice',
  ...extra,
})
const cfg = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULTS, ...over })

const DICTATED = 'can you fix the grammer on this file it have many mistake'
const FIXED = 'Can you fix the grammar on this file? It has many mistakes.'

describe('what the agent receives', () => {
  test('a dictated prompt becomes the fixed text, and by default adds nothing to the agent\'s context', async () => {
    const r = rig([fast('grammar', 90, FIXED, 'Use "has" with "it".')])
    const out = await polish(r.deps, cfg(), voice(DICTATED, { context: ['earlier context'] }))
    expect(out?.text).toBe(FIXED)
    expect(out?.context).toEqual(['earlier context'])
    expect(r.logs.some(l => l.includes('tip:'))).toBe(true)
    expect(r.calls.length).toBe(1)
    expect(nth(r.calls, 0).model).toBe('haiku')
    expect(nth(r.calls, 0).effort).toBe('low')
    expect(nth(r.calls, 0).prompt).toBe(`<prompt>\n${DICTATED}\n</prompt>`)
  })

  test('a prompt that is already clean is sent untouched', async () => {
    const r = rig([fast('grammar', 90, ` ${DICTATED} `, 'none')])
    expect(await polish(r.deps, cfg(), voice(DICTATED))).toBe(null)
  })

  test('the agent never gets an empty or placeholder prompt', async () => {
    for (const bad of ['<the corrected prompt>', '', '   ', '<your corrected version of the prompt>']) {
      const r = rig([fast('grammar', 90, bad)])
      expect(await polish(r.deps, cfg(), voice(DICTATED))).toBe(null)
    }
  })

  test('a model failure, odd reply or thrown error sends the original', async () => {
    const failed: ModelCompleteResult = { isAnswered: false, reason: 'empty-reply' } as never
    expect(await polish(rig([failed]).deps, cfg(), voice(DICTATED))).toBe(null)
    expect(await polish(rig([reply('Sure! Here you go.')]).deps, cfg(), voice(DICTATED))).toBe(null)
    expect(await polish(rig([]).deps, cfg(), voice(DICTATED))).toBe(null)
  })
})

describe('what it leaves alone, without calling any model', () => {
  const cases: [string, Input][] = [
    ['a slash command', voice(DICTATED, { isCommand: true })],
    ['a hidden prompt', voice(DICTATED, { isMeta: true })],
    ['an SDK prompt', voice(DICTATED, { originKind: 'sdk' })],
    ['a notification', voice(DICTATED, { originKind: 'notification' })],
    ['a prompt with pasted content', voice(DICTATED, { pastedChars: 300 })],
    ['a very short prompt', voice('yes please')],
    ['a multi-line prompt', voice('Add dark mode.\n\nIt should follow the system theme.')],
    ['a bulleted prompt', voice('Do these: - add the page - wire the route - write tests')],
    ['a code block', voice('why does ```x = 1``` fail here')],
  ]
  for (const [name, input] of cases) {
    test(name, async () => {
      const r = rig([])
      expect(await polish(r.deps, cfg(), input)).toBe(null)
      expect(r.calls.length).toBe(0)
    })
  }
})

describe('recommendations and the dialog', () => {
  const VAGUE = 'so uh the thing with the login it is not really working right can you look'

  test('a confident improve recommendation applies the grammar fix only, with a hint', async () => {
    const r = rig([fast('improve', 90, 'So the login is not working right. Can you look?')])
    const out = await polish(r.deps, cfg(), voice(VAGUE))
    expect(out?.text).toBe('So the login is not working right. Can you look?')
    expect(r.calls.length).toBe(1)
    expect(r.asked.length).toBe(0)
    expect(r.logs.some(l => l.includes('improve:'))).toBe(true)
  })

  test('with auto-improve on, a confident improve runs the improve model', async () => {
    const r = rig([fast('improve', 90, 'x y z'), improved('Fix the login failure. Steps and logs are below.')])
    const out = await polish(r.deps, cfg({ isAutoImproving: true, isAttachingOriginal: true }), voice(VAGUE))
    expect(r.calls.length).toBe(2)
    expect(nth(r.calls, 1).model).toBe('opus')
    expect(nth(r.calls, 1).prompt).toBe(`<prompt>\n${VAGUE}\n</prompt>`)
    expect(out?.text).toBe('Fix the login failure. Steps and logs are below.')
    expect(out?.context.at(0)).toContain('restructured')
    expect(out?.context.at(0)).toContain(VAGUE)
  })

  test('an unsure model asks, recommended choice first', async () => {
    const r = rig([fast('improve', 20, 'So the login fails. Can you look?'), improved('Investigate the login failure.')], 'Improve for the agent (Recommended)')
    const out = await polish(r.deps, cfg(), voice(VAGUE))
    expect(r.asked.length).toBe(1)
    expect(nth(r.asked, 0).options[0]).toBe('Improve for the agent (Recommended)')
    expect(nth(r.asked, 0).options.length).toBe(3)
    expect(out?.text).toBe('Investigate the login failure.')
  })

  test('middling confidence does not interrupt: only a truly unsure model asks', async () => {
    for (const confidence of [30, 45, 69, 95]) {
      const r = rig([fast('improve', confidence, 'Fixed text here ok.')])
      const out = await polish(r.deps, cfg(), voice(VAGUE))
      expect(r.asked.length).toBe(0)
      expect(out?.text).toBe('Fixed text here ok.')
    }
    const unsure = rig([fast('improve', 29, 'Fixed text here ok.')], 'Send original')
    await polish(unsure.deps, cfg(), voice(VAGUE))
    expect(unsure.asked.length).toBe(1)
    expect(nth(unsure.asked, 0).question).toContain('29%')
  })

  test('the ask threshold is configurable, and 0 never asks', async () => {
    const strict = rig([fast('improve', 60, 'Fixed text here ok.')], 'Send original')
    await polish(strict.deps, cfg({ askBelowConfidence: 70 }), voice(VAGUE))
    expect(strict.asked.length).toBe(1)

    const never = rig([fast('improve', 1, 'Fixed text here ok.')])
    await polish(never.deps, cfg({ askBelowConfidence: 0 }), voice(VAGUE))
    expect(never.asked.length).toBe(0)
  })

  test('the dialog can choose grammar only or the original', async () => {
    const grammar = rig([fast('improve', 20, 'Fixed text here ok.')], 'Fix grammar only')
    expect((await polish(grammar.deps, cfg(), voice(VAGUE)))?.text).toBe('Fixed text here ok.')
    expect(grammar.calls.length).toBe(1)

    const original = rig([fast('improve', 20, 'Fixed text here ok.')], 'Send original')
    expect(await polish(original.deps, cfg(), voice(VAGUE))).toBe(null)
  })

  test('a dismissed dialog sends the original', async () => {
    const r = rig([fast('improve', 20, 'Fixed text here ok.')], new Error('dismissed'))
    expect(await polish(r.deps, cfg(), voice(VAGUE))).toBe(null)
  })

  test('with the dialog off, an unsure model just applies its recommendation', async () => {
    const r = rig([fast('grammar', 20, 'Fixed text here ok.')])
    const out = await polish(r.deps, cfg({ isAskingWhenUnsure: false }), voice(VAGUE))
    expect(r.asked.length).toBe(0)
    expect(out?.text).toBe('Fixed text here ok.')
  })

  test('"original" means too garbled: send the original', async () => {
    const r = rig([fast('original', 90, 'guess guess guess guess')])
    expect(await polish(r.deps, cfg(), voice(VAGUE))).toBe(null)
  })

  test('a failed improve falls back to the grammar fix', async () => {
    const r = rig([fast('improve', 90, 'Grammar fixed text here.'), reply('nope')])
    const out = await polish(r.deps, cfg({ isAutoImproving: true }), voice(VAGUE))
    expect(out?.text).toBe('Grammar fixed text here.')
  })
})

describe('explicit "improve:" requests', () => {
  test('goes straight to the improve model with the phrase removed', async () => {
    const r = rig([improved('Add dark mode that follows the system theme.')])
    const out = await polish(r.deps, cfg({ isAttachingOriginal: true }), voice('improve: add dark mode to the settings page'))
    expect(r.calls.length).toBe(1)
    expect(nth(r.calls, 0).model).toBe('opus')
    expect(nth(r.calls, 0).prompt).toBe('<prompt>\nadd dark mode to the settings page\n</prompt>')
    expect(r.asked.length).toBe(0)
    expect(out?.text).toBe('Add dark mode that follows the system theme.')
    expect(out?.context.at(0)).toContain('add dark mode to the settings page')
  })

  test('works on a typed multi-line prompt too', async () => {
    const r = rig([improved('Restructured.')])
    const out = await polish(r.deps, cfg(), voice('improve:\nadd dark mode\n- follow the theme'))
    expect(out?.text).toBe('Restructured.')
  })

  test('if the improve model fails, the agent still gets the prompt without the phrase', async () => {
    const r = rig([reply('nope')])
    const out = await polish(r.deps, cfg(), voice('improve: add dark mode to the settings page'))
    expect(out?.text).toBe('add dark mode to the settings page')
  })
})

describe('the diagnostics log', () => {
  const SECRET_WORDS = 'confidential merger codename zebra'
  const SPOKEN = `so uh ${SECRET_WORDS} needs the login looked at it is not really working right`

  test('records decisions, and never the prompt or any rewrite of it', async () => {
    const rewrite = `So ${SECRET_WORDS} needs its login looked at.`
    const r = rig([fast('grammar', 90, rewrite, `Say "its" not "it", about ${SECRET_WORDS}.`)])
    await polish(r.deps, cfg(), voice(SPOKEN))
    expect(r.records.length > 0).toBe(true)
    const all = r.records.join('\n')
    for (const leaked of [SECRET_WORDS, 'zebra', 'login', 'looked']) expect(all).not.toContain(leaked)
    expect(all).toContain('confidence=90')
  })

  test('skips and failures are recorded too, still without the prompt', async () => {
    const skipped = rig([])
    await polish(skipped.deps, cfg(), voice(SPOKEN, { pastedChars: 400 }))
    expect(skipped.records.join('\n')).toContain('pasted content')

    const failed = rig([{ isAnswered: false, reason: 'api-error' } as never])
    await polish(failed.deps, cfg(), voice(SPOKEN))
    expect(failed.records.join('\n')).toContain('api-error')
    expect(failed.records.join('\n')).not.toContain('zebra')
  })
})

describe('voice versus typed proofreading', () => {
  test('a dictated prompt gets the dictation cleanup instructions', async () => {
    const r = rig([fast('grammar', 90, FIXED)])
    await polish(r.deps, cfg(), voice(DICTATED, { source: 'voice' }))
    const system = String(nth(r.calls, 0).system)
    expect(system).toContain('Stutters')
    expect(system).toContain('False starts')
  })

  test('a typed-only prompt gets the light proofread: no stutter or false-start cleanup', async () => {
    const r = rig([fast('grammar', 90, FIXED)])
    await polish(r.deps, cfg(), voice(DICTATED, { source: 'typed' }))
    const system = String(nth(r.calls, 0).system)
    expect(system).toContain('proofread')
    expect(system).not.toContain('Stutters')
    expect(system).not.toContain('False starts')
  })

  test('the log says which kind of prompt it was', async () => {
    const r = rig([fast('grammar', 90, FIXED)])
    await polish(r.deps, cfg(), voice(DICTATED, { source: 'typed' }))
    expect(r.records.join('\n')).toContain('typed')
  })
})

describe('the journal port', () => {
  test('a rewrite hands over the error codes, the tip and both sentences', async () => {
    const r = rig([fast('grammar', 90, FIXED, 'Use "has" with "it".', 'subject-verb-agreement, spelling, nonsense')])
    await polish(r.deps, cfg(), voice(DICTATED, { source: 'voice' }))
    const e = nth(r.entries, 0)
    expect(e.action).toBe('grammar')
    expect(e.source).toBe('voice')
    expect(e.errors).toEqual(['subject-verb-agreement', 'spelling'])
    expect(e.said).toBe(DICTATED)
    expect(e.fixed).toBe(FIXED)
    expect(e.tip).toBe('Use "has" with "it".')
  })

  test('a prompt the model found clean is journaled as clean, with no errors', async () => {
    const r = rig([fast('grammar', 95, DICTATED)])
    await polish(r.deps, cfg(), voice(DICTATED))
    expect(r.entries.length).toBe(1)
    expect(nth(r.entries, 0).action).toBe('clean')
    expect(nth(r.entries, 0).errors).toEqual([])
  })

  test('an improve request is journaled as improve', async () => {
    const r = rig([improved('Add dark mode that follows the theme.')])
    await polish(r.deps, cfg(), voice('improve: add dark mode to the settings page'))
    expect(nth(r.entries, 0).action).toBe('improve')
  })

  test('skipped prompts and failures journal nothing', async () => {
    const skipped = rig([])
    await polish(skipped.deps, cfg(), voice(DICTATED, { pastedChars: 300 }))
    expect(skipped.entries.length).toBe(0)

    const failed = rig([{ isAnswered: false, reason: 'api-error' } as never])
    await polish(failed.deps, cfg(), voice(DICTATED))
    expect(failed.entries.length).toBe(0)
  })
})

describe('the hidden original note (costs context, so it is opt-in)', () => {
  test('off by default: neither a rewrite nor an improve adds any context', async () => {
    const a = rig([fast('grammar', 90, FIXED)])
    expect((await polish(a.deps, cfg(), voice(DICTATED)))?.context).toEqual([])
    const b = rig([improved('Add dark mode.')])
    expect((await polish(b.deps, cfg(), voice('improve: add dark mode to the settings page')))?.context).toEqual([])
  })

  test('on: the original rides along once, after any context already there', async () => {
    const r = rig([fast('grammar', 90, FIXED)])
    const out = await polish(r.deps, cfg({ isAttachingOriginal: true }), voice(DICTATED, { context: ['earlier context'] }))
    expect(out?.context.length).toBe(2)
    expect(out?.context.at(0)).toBe('earlier context')
    expect(out?.context.at(1)).toContain(DICTATED)
  })
})

describe('bypass', () => {
  test('sent exactly as written minus the opening phrase: no model call, no dialog, no journal', async () => {
    const r = rig([])
    const out = await polish(r.deps, cfg(), voice('bypass: can you fix teh grammer on this file it have many mistake', { context: ['earlier context'] }))
    expect(out?.text).toBe('can you fix teh grammer on this file it have many mistake')
    expect(out?.context).toEqual(['earlier context'])
    expect(r.calls.length).toBe(0)
    expect(r.asked.length).toBe(0)
    expect(r.entries.length).toBe(0)
  })

  test('it beats every other rule, including pasted content, a short prompt and structure', async () => {
    const r = rig([])
    expect((await polish(r.deps, cfg(), voice('raw: ok', { pastedChars: 900 })))?.text).toBe('ok')
    const structured = await polish(r.deps, cfg(), voice('bypass: do this:\n- one\n- two\n- three'))
    expect(structured?.text).toBe('do this:\n- one\n- two\n- three')
    expect(r.calls.length).toBe(0)
  })

  test('it beats improve: too, and never applies to a command or a non-person prompt', async () => {
    const r = rig([])
    expect((await polish(r.deps, cfg(), voice('bypass: improve: add dark mode')))?.text).toBe('improve: add dark mode')
    expect(await polish(r.deps, cfg(), voice('bypass: not a person', { originKind: 'sdk' }))).toBe(null)
    expect(await polish(r.deps, cfg(), voice('bypass: /clear', { isCommand: true }))).toBe(null)
    expect(r.calls.length).toBe(0)
  })

  test('it is recorded in the diagnostics log without the prompt text', async () => {
    const r = rig([])
    await polish(r.deps, cfg(), voice('bypass: secret falcon launch codes tomorrow'))
    expect(r.records.join('\n')).toContain('bypass')
    expect(r.records.join('\n')).not.toContain('falcon')
  })
})

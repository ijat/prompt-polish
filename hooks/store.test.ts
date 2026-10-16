import { expect, test } from 'claude-code/testing'

import type { JournalEntry } from './journal'
import { DEFAULTS } from './settings'
import { agentNoteFor, readPolishConfig, writeJournal } from './store'

const SAID = 'rotate the production database password for project falcon'
const FIXED = 'Rotate the production database password for Project Falcon.'

const entry: JournalEntry = {
  nowMs: Date.UTC(2026, 9, 16, 5, 0, 0),
  source: 'voice',
  action: 'grammar',
  confidence: 88,
  errors: ['capitalization'],
  tip: 'Capitalize proper names like Project Falcon.',
  said: SAID,
  fixed: FIXED,
}

const HOME = '/home/test'
const CONFIG_PATH = `${HOME}/.claude/prompt-polish.config.json`
const JOURNAL_FILE = `${HOME}/.claude/prompt-polish-journal/2026-10.jsonl`

type Write = { path: string; text: string }

/**
 * A fake engine with only the calls the adapter uses: an in-memory disk, the folders that hold a `.git`,
 * and every write recorded. A missing file rejects, as the real `$.fs.read` does.
 */
const fakeEngine = (files: Record<string, string>, gitRoots: readonly string[] = []) => {
  const writes: Write[] = []
  const $ = {
    env: { get: async (name: string) => (name === 'HOME' ? HOME : undefined) },
    clock: { now: async () => entry.nowMs },
    fs: {
      read: async (path: string) => {
        const text = files[path]
        if (text === undefined) throw new Error(`ENOENT: ${path}`)
        return text
      },
      write: async (path: string, text: string) => {
        files[path] = text
        writes.push({ path, text })
      },
      exists: async (path: string) => gitRoots.some(r => path === `${r}/.git`),
    },
  }
  return { $: $ as never, writes, files }
}

const withConfig = (json: string) => ({ [CONFIG_PATH]: json })

test('with no config file, nothing is written', async () => {
  const e = fakeEngine({})
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes.length).toBe(0)
})

test('an enabled:false config writes nothing', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":false,"level":"sentences"}}'))
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes.length).toBe(0)
})

test('malformed JSON in the config writes nothing', async () => {
  const e = fakeEngine(withConfig('{ nope'))
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes.length).toBe(0)
})

test('opted in at the tags level: one monthly file, and no text of the prompt in it', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"tags"}}'))
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes.length).toBe(1)
  expect(e.writes[0]?.path).toBe(JOURNAL_FILE)
  const text = e.writes[0]?.text ?? ''
  for (const leaked of ['falcon', 'Falcon', 'password', SAID, FIXED]) expect(text).not.toContain(leaked)
  expect(JSON.parse(text.trim()).errors).toEqual(['capitalization'])
})

test('opted in at the sentences level: the sentences are written', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"sentences"}}'))
  await writeJournal(e.$, DEFAULTS, entry)
  const stored = JSON.parse((e.writes[0]?.text ?? '').trim())
  expect(stored.said).toBe(SAID)
  expect(stored.fixed).toBe(FIXED)
})

test('later prompts append to the same month file', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"tags"}}'))
  await writeJournal(e.$, DEFAULTS, entry)
  await writeJournal(e.$, DEFAULTS, { ...entry, action: 'clean' })
  expect((e.files[JOURNAL_FILE] ?? '').trim().split('\n').length).toBe(2)
})

test('a configured folder is used, with ~ expanded', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"tags","directory":"~/notes/pp"}}'))
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes[0]?.path).toBe(`${HOME}/notes/pp/2026-10.jsonl`)
})

test('a journal folder inside a git repository is refused; only a text-free notice is logged', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"sentences","directory":"/work/proj/notes"}}'), ['/work/proj'])
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes.some(w => w.path.startsWith('/work/proj'))).toBe(false)
  expect(e.writes.some(w => w.text.includes('inside a git repository'))).toBe(true)
  for (const w of e.writes) {
    expect(w.text).not.toContain('falcon')
    expect(w.text).not.toContain('Falcon')
  }
})

test('the home folder itself being a repository refuses the default folder too', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"tags"}}'), [HOME])
  await writeJournal(e.$, DEFAULTS, entry)
  expect(e.writes.some(w => w.path.includes('prompt-polish-journal'))).toBe(false)
})

test('a failing disk never throws into the prompt', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"tags"}}'))
  ;(e.$ as unknown as { fs: { write: () => Promise<void> } }).fs.write = async () => {
    throw new Error('disk full')
  }
  await writeJournal(e.$, DEFAULTS, entry)
})

test('readPolishConfig reads the bypass rules and the journal from the one file', async () => {
  const e = fakeEngine(withConfig('{"journal":{"enabled":true,"level":"tips"},"bypass":{"modelCheck":true,"phrases":["verbatim"]}}'))
  const c = await readPolishConfig(e.$)
  expect(c.journal?.level).toBe('tips')
  expect(c.bypass).toEqual({ isEnabled: true, extraPhrases: ['verbatim'], isModelChecking: true })
})

test('readPolishConfig with no file gives the defaults', async () => {
  const c = await readPolishConfig(fakeEngine({}).$)
  expect(c.journal).toBe(null)
  expect(c.bypass.isModelChecking).toBe(false)
  expect(c.bypass.isEnabled).toBe(true)
})

test('the agent note carries this machine\'s real log path', async () => {
  const note = await agentNoteFor(fakeEngine({}).$, DEFAULTS)
  expect(note).toContain(`${HOME}/.claude/prompt-polish.log`)
})

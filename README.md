# prompt-polish

A Claude Code mod for people who dictate prompts. It cleans up each spoken prompt before the agent sees it, shows you what changed, and gives a one-line grammar tip so you improve over time.

## What it does

- Rewrites a flat, spoken-style prompt: fixes grammar, punctuation and speech-to-text slips, keeping your meaning. A small, fast model does this (Haiku by default).
- Sends the agent the cleaned prompt. Your original stays out of the agent's context by default, so nothing accumulates there; turn on `isAttachingOriginal` to attach it as a hidden note (about 60-150 tokens per rewritten prompt) as a safety net if a rewrite might miss your intent.
- Prints what happened under your prompt, and flashes a short `polish:` status that clears after a few seconds:

  ```
  [polish] rewrote
    you said: can you fix the grammer on this file it have many mistake
    sent as:  Can you fix the grammar on this file? It has many mistakes.
    tip:      "It" is singular, so use "has" and "mistakes" (plural after "many").
  ```

- Leaves a prompt completely alone if it contains pasted content (20 or more pasted characters, detected from how the text entered the prompt box; nothing is stored).
- Leaves alone anything you clearly typed on purpose: multi-line prompts, pasted text, bullet or numbered lists, code fences, prompts over 250 words, prompts under 4 words, slash commands, and anything not typed or dictated by you (notifications, other sessions, SDK runs).

## Voice or typed

The dictation cleanup (stutters, repeated fragments, false starts, "uh", misheard words) runs only on prompts that involved voice. The mod tells by watching how text entered the prompt box: Claude Code's built-in voice writes into the box itself, while typing arrives as key presses and a paste as one key-less edit. A voice-only or a mixed voice-and-typing prompt gets the dictation cleanup. A typed-only prompt gets a light proofread (grammar, spelling, punctuation) and its wording is otherwise left alone. A paste is never touched.

Only the built-in voice is detected. With a third-party dictation tool the text looks typed, so set `sourceMode` to `voice` to get the cleanup anyway.

## Bypass: send exactly as written

Start a prompt with `bypass:` (also `raw:`, `no polish:`, `skip polish:`, or a dash instead of the colon; `Bypass.` and `No polish.` work too, since dictation writes a period for a pause) and the mod skips everything: no model call, no rewrite, no dialog, no journal entry. Only that opening phrase is removed; the rest goes to the agent unchanged. It wins over every other rule, including `improve:`. It applies only to prompts you typed or dictated, never to slash commands. A prompt that merely starts with those words, like "bypass the cache for this request", is not a bypass.

Configure it in `~/.claude/prompt-polish.config.json` (see `prompt-polish.config.example.json`; edits apply to the next prompt):

```json
{ "bypass": { "enabled": true, "phrases": ["verbatim"], "modelCheck": false } }
```

- `enabled` (default `true`): `false` turns the phrase rules off.
- `phrases`: your own opening words, each followed by `:` `.` `-` or `—`. Plain words only.
- `modelCheck` (default `false`; must be exactly `true`): also let the model decide, from the sentence, whether you asked for the message to be left alone ("send this exactly as I said", "don't rewrite this"). It costs no extra call: it is one more answer line in the existing fast call. Orders about the work ("don't touch the login file") are meant to be ignored. In my test on synthetic prompts (8 real requests and 14 look-alikes, each run twice), Haiku caught 16 of 16 requests with 3 of 28 false alarms, and Sonnet caught 16 of 16 with 0 of 28 false alarms. A false alarm only means that one prompt is sent without cleanup. If you turn this on, set `fastModel` to a Sonnet model.

## Your own names

Dictation and the model split or "correct" names they don't know, for example "socialman" written as "social man". List your names in the same config file:

```json
{ "vocabulary": { "names": ["socialman", "LuneTube", { "name": "socials", "autofix": false }], "project": true } }
```

- `names`: written exactly as they should appear (letters, digits, `.` `-` `_`; up to 40 characters, 30 names in total). They are added to the model's instructions so it writes them as listed.
- After the model replies, a name it left split by spaces or a hyphen ("Social Man", "social-man") is joined back. This applies only to single words of letters and digits at least 5 long, and never inside paths or file names (`social-man.ts`, `src/social man`). Set `"autofix": false` on a name that is also a phrase you really use.
- `project` (default `true`): also add the current project's names: its folder, its `package.json` name and its git `origin` repository name. `false` turns this off.

## Recommendations, and when it asks

The fast model recommends one of three actions for each prompt: fix the grammar, improve it, or send the original (when dictation is too garbled to correct reliably), and says how sure it is.

- **Confident:** it just acts, no question. A confident "improve" recommendation is logged as a hint and gets the grammar fix; it does not run the stronger model on its own unless `isAutoImproving` is on.
- **Not confident** (confidence under `askBelowConfidence`, default 30 of 100): a dialog asks, with the recommended choice first and marked.
- **You ask:** start a prompt with `improve:` (or `polish this prompt -`), or end it with `... improve this prompt`. A stronger model (Opus by default) restructures it into a clear brief, no dialog. The request phrase is removed, and your original is attached for the agent.

## Install

At the prompt of a terminal session:

```
/plugin install prompt-polish --marketplace ijat/prompt-polish
```

From a shell:

```
claude plugin install prompt-polish --marketplace ijat/prompt-polish
```

To try it from a local folder without installing: `claude --plugin-dir <folder>`.

## Settings

All optional; edit them in the Claude Code config menu.

| Setting | Default | Meaning |
| --- | --- | --- |
| `isEnabled` | `true` | Turn the rewrite on or off. |
| `fastModel` / `fastEffort` | `haiku` / `low` | Model that fixes grammar and classifies each prompt. |
| `improveModel` / `improveEffort` | `opus` / `medium` | Model used for `improve:` requests. |
| `isAskingWhenUnsure` | `true` | Show the dialog when the fast model isn't confident. |
| `askBelowConfidence` | `30` | Ask only when confidence (0-100) is below this; rambling is treated as normal. |
| `isAttachingOriginal` | `false` | Attach your original to the agent as a hidden note. Adds context tokens to every rewritten prompt. |
| `isAutoImproving` | `false` | Run the improve model automatically on a confident "improve" recommendation. |
| `minPastedChars` | `20` | A prompt with at least this many pasted characters is never rewritten, not even by `improve:`. |
| `minWords` / `maxWords` | `4` / `250` | Prompts outside this range are left alone. |
| `sourceMode` | `auto` | `auto` detects voice vs typed; `voice` or `typed` pins it (use `voice` with a third-party dictation tool). |
| `display` | `off` | `off`, `status` or `full`: what the mod shows in the session. |
| `isTellingAgent` | `true` | Tell the agent where the log is (about 80 tokens, once per session). |
| `isLogging` / `logPath` | `true` / empty | Write the diagnostics log; empty path means `~/.claude/prompt-polish.log`. |
| `statusSeconds` | `8` | How long the `polish:` status stays. |

## Diagnostics log

Each decision is also written to `~/.claude/prompt-polish.log` (on Windows, `%USERPROFILE%\.claude\prompt-polish.log`): a timestamp, what the mod did and why (`skipped (pasted content)`, `model failed (api-error)`, the model's action and confidence), and text lengths. It never contains your prompt or any rewrite of it. The last 300 lines are kept. Attach the file when reporting a problem. Turn it off with `isLogging`, or move it with `logPath`.

## What it shows, and telling the agent

By default the mod shows **nothing** in your session. Set `display` to choose: `off` (default), `status` (only the short `polish:` line, which clears after a few seconds), or `full` (the status plus the `[polish]` before/after and tip lines in the transcript). Details always go to the debug log (`claude --debug`) and decisions to the diagnostics log. The question dialog still appears when the model is unsure, because it needs your answer.

Since the agent can't see what the mod did, the mod adds one short note (about 80 tokens, once per session; setting `isTellingAgent`) telling it to read `~/.claude/prompt-polish.log` if you ask whether the mod is working. On a Claude Code managed by an organization, plugins you install can't add to the system prompt, so the mod sends the same note once through the prompt itself, on your second prompt.

## Learning journal (opt-in, local only)

Off by default. To study your own mistakes later, create `~/.claude/prompt-polish.config.json` (on Windows `%USERPROFILE%\.claude\prompt-polish.config.json`). See `prompt-polish.config.example.json`:

```json
{
  "journal": { "enabled": true, "level": "tags", "directory": "" }
}
```

- `enabled` must be exactly `true`. A missing or malformed file keeps it off.
- `level` controls how much is recorded. `tags` (the default): date, voice or typed, action, confidence, and a list of mistake types such as `subject-verb-agreement` or `stutter`, with **none of your text**. `tips` adds the tip sentence. `sentences` adds your original and the fixed sentence, which is **your prompt text**: use it only where that is acceptable (not for confidential work prompts).
- Files are written to `~/.claude/prompt-polish-journal/YYYY-MM.jsonl` (one line per prompt), or to `directory`.
- **It never leaves your machine.** The journal is written only to local disk. The mod refuses to write if the folder is inside a git repository (it checks the folder and every parent for `.git`), `.gitignore` lists the config and journal files, and the config file lives outside this repository.
- Mistake types come from a model choosing from a fixed list, so treat them as a rough guide, not a grade.

## Costs and limits

- Every polished prompt makes one extra short model call, so expect about a second of delay and a small cost. An `improve:` request makes one Opus call.
- Rewrites can occasionally change nuance. The `you said` / `sent as` lines are there so you can check, and the agent always receives your original too.
- If the model call fails or times out, your original prompt is sent unchanged.
- It cannot rewrite slash commands; the engine does not allow it.

## Development

```
claude plugin validate .
claude plugin test .
pnpm --package=typescript dlx tsc -p . --noEmit   # type-check
```

Layout (`hooks/`), each file with one job:

| File | Responsibility |
| --- | --- |
| `register.ts` | The only file that touches the engine: binds it to the ports and hooks `prompt.submit`. |
| `polish.ts` | The decision flow, as a small class of named steps. Depends only on the ports. |
| `ports.ts` | The interface the flow needs from the engine (model call, dialog, log, status). |
| `provenance.ts` | Tells pasted text from typed text (`prompt.edit` events without a key press). |
| `gate.ts` | When to leave a prompt alone; structure detection; the `improve:` request. |
| `protocol.ts` | The prompts sent to the models and the parser for their replies. |
| `journal.ts` | The opt-in learning journal: config parsing, what each level may store, the no-git-repo guard. |
| `store.ts` | The only code that writes to disk (the diagnostics log and the journal); also reads the project's names. |
| `config.ts` | Parses the person's config file: the bypass rules (the journal is parsed by `journal.ts`, the names by `vocab.ts`). |
| `vocab.ts` | Your own names: config parsing, the project's names, the note for the model, and joining split names back. |
| `agentnote.ts` | The short note that tells the agent where the log is, and the tracker that sends it once by the route that works. |
| `logfile.ts` | Where the diagnostics log goes and how it is trimmed. |
| `report.ts` | What the person sees: status line and transcript. |
| `settings.ts` | Options with defaults and validation. |

Because the flow depends on ports, `polish.test.ts` drives it with a scripted fake model and dialog and asserts exactly what text and context the agent would receive.

## License

MIT

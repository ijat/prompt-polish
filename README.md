# prompt-polish

A Claude Code mod for people who dictate prompts. It cleans up each spoken prompt before the agent sees it, shows you what changed, and gives a one-line grammar tip so you improve over time.

## What it does

- Rewrites a flat, spoken-style prompt: fixes grammar, punctuation and speech-to-text slips, keeping your meaning. A small, fast model does this (Haiku by default).
- Sends the agent the cleaned prompt, plus your original as hidden context, so a wrong guess never loses what you said.
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
| `isAutoImproving` | `false` | Run the improve model automatically on a confident "improve" recommendation. |
| `minPastedChars` | `20` | A prompt with at least this many pasted characters is never rewritten, not even by `improve:`. |
| `minWords` / `maxWords` | `4` / `250` | Prompts outside this range are left alone. |
| `sourceMode` | `auto` | `auto` detects voice vs typed; `voice` or `typed` pins it (use `voice` with a third-party dictation tool). |
| `isLogging` / `logPath` | `true` / empty | Write the diagnostics log; empty path means `~/.claude/prompt-polish.log`. |
| `statusSeconds` | `8` | How long the `polish:` status stays. |

## Diagnostics log

Each decision is also written to `~/.claude/prompt-polish.log` (on Windows, `%USERPROFILE%\.claude\prompt-polish.log`): a timestamp, what the mod did and why (`skipped (pasted content)`, `model failed (api-error)`, the model's action and confidence), and text lengths. It never contains your prompt or any rewrite of it. The last 300 lines are kept. Attach the file when reporting a problem. Turn it off with `isLogging`, or move it with `logPath`.

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
| `store.ts` | The only code that writes to disk: the diagnostics log and the journal. |
| `logfile.ts` | Where the diagnostics log goes and how it is trimmed. |
| `report.ts` | What the person sees: status line and transcript. |
| `settings.ts` | Options with defaults and validation. |

Because the flow depends on ports, `polish.test.ts` drives it with a scripted fake model and dialog and asserts exactly what text and context the agent would receive.

## License

MIT

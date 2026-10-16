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

- Leaves alone anything you clearly typed on purpose: multi-line prompts, pasted text, bullet or numbered lists, code fences, prompts over 250 words, prompts under 4 words, slash commands, and anything not typed or dictated by you (notifications, other sessions, SDK runs).

## Recommendations, and when it asks

The fast model recommends one of three actions for each prompt: fix the grammar, improve it, or send the original (when dictation is too garbled to correct reliably), and says how sure it is.

- **Confident:** it just acts, no question. A confident "improve" recommendation is logged as a hint and gets the grammar fix; it does not run the stronger model on its own unless `isAutoImproving` is on.
- **Not confident:** a dialog asks, with the recommended choice first and marked.
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
| `isAutoImproving` | `false` | Run the improve model automatically on a confident "improve" recommendation. |
| `minWords` / `maxWords` | `4` / `250` | Prompts outside this range are left alone. |
| `statusSeconds` | `8` | How long the `polish:` status stays. |

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
| `gate.ts` | When to leave a prompt alone; structure detection; the `improve:` request. |
| `protocol.ts` | The prompts sent to the models and the parser for their replies. |
| `report.ts` | What the person sees: status line and transcript. |
| `settings.ts` | Options with defaults and validation. |

Because the flow depends on ports, `polish.test.ts` drives it with a scripted fake model and dialog and asserts exactly what text and context the agent would receive.

## License

MIT

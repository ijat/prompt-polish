import type { Input } from './gate'
import { explicitImprove, skipReason } from './gate'
import type { Deps } from './ports'
import type { Action, Parsed } from './protocol'
import { CHOICES, FAST_SYSTEM_TYPED, FAST_SYSTEM_VOICE, IMPROVE_SYSTEM, RECOMMENDED_SUFFIX, asData, parse } from './protocol'
import { Reporter } from './report'
import type { Settings } from './settings'

/** What replaces the prompt. `null` means send it exactly as it came. */
export type Outcome = { text: string; context: readonly string[] } | null

const FAST_TIMEOUT_MS = 8_000
const FAST_MAX_TOKENS = 2_048
const IMPROVE_TIMEOUT_MS = 60_000
const IMPROVE_MAX_TOKENS = 4_096

const ACTIONS: readonly Action[] = ['grammar', 'improve', 'original']

/** A unit of work that knows its dependencies; keeps the steps below small and testable. */
class Polisher {
  private readonly report: Reporter

  constructor(
    private readonly deps: Deps,
    private readonly cfg: Settings,
    private readonly input: Input,
  ) {
    this.report = new Reporter(deps)
  }

  async run(): Promise<Outcome> {
    const request = explicitImprove(this.input.text)
    const skip = skipReason(this.input, this.cfg, request.isExplicit)
    if (skip) {
      this.report.note(`skipped (${skip})`)
      return null
    }
    try {
      return request.isExplicit ? await this.improveOnRequest(request.text) : await this.recommendAndApply()
    } catch (err) {
      this.report.note(`error (${String(err)}), sent original`)
      return null
    }
  }

  /** The person asked for it: one call to the improve model, no questions. */
  private async improveOnRequest(text: string): Promise<Outcome> {
    const improved = await this.callImprove(text)
    if (!improved) {
      this.report.note('improve failed, sent your text without the request phrase')
      return { text, context: this.input.context ?? [] }
    }
    this.report.rewrite(`improved with ${this.cfg.improveModel} (you asked)`, text, improved.rewrite, improved.tip)
    return this.deliver(improved.rewrite, `The prompt above was restructured for clarity at the user's request. Original: "${text}".`)
  }

  /** The default path: the fast model fixes the prompt and recommends what else to do. */
  private async recommendAndApply(): Promise<Outcome> {
    const fast = await this.callFast()
    if (!fast) return null

    const recommended = fast.action ?? 'grammar'
    const isUnsure = fast.action !== undefined && fast.confidence < this.cfg.askBelowConfidence
    const action = await this.resolveAction(recommended, isUnsure, fast.confidence)
    if (action === null || action === 'original') {
      if (action === 'original') this.report.note(`sent original (${isUnsure ? 'you chose' : 'too garbled to correct'})`)
      return null
    }

    const wasImproved = action === 'improve' && (await this.callImprove(this.input.text))
    const chosen: Parsed = wasImproved || fast
    const label = wasImproved ? `improved with ${this.cfg.improveModel}` : 'rewrote'
    if (action === 'improve' && !wasImproved) this.report.note('improve model failed, used the grammar fix')

    if (chosen.rewrite === this.input.text.trim()) {
      this.report.note('ran, prompt already clean')
      return null
    }
    this.report.rewrite(`${label} last prompt`, this.input.text, chosen.rewrite, chosen.tip)
    const how = wasImproved ? ' and restructured for clarity' : ''
    return this.deliver(chosen.rewrite, `The prompt above was auto-corrected from voice dictation${how}. Original as dictated: "${this.input.text}".`)
  }

  /**
   * The action to take. Confident recommendations are applied without asking; an unsure one
   * asks (recommended choice first) when allowed. `null` means the dialog was dismissed.
   */
  private async resolveAction(recommended: Action, isUnsure: boolean, confidence: number): Promise<Action | null> {
    if (isUnsure && this.cfg.isAskingWhenUnsure) return this.askPerson(recommended, confidence)
    if (recommended === 'improve' && !isUnsure && !this.cfg.isAutoImproving) {
      this.report.hint('recommend: improve this one. Start a prompt with "improve:" to have a stronger model restructure it.')
      return 'grammar'
    }
    return recommended
  }

  private async askPerson(recommended: Action, confidence: number): Promise<Action | null> {
    const order = [recommended, ...ACTIONS.filter(a => a !== recommended)]
    try {
      const choice = await this.deps.ask(`Not sure how to handle this prompt (confidence ${confidence}%). What should I do?`, {
        options: order.map((a, i) => CHOICES[a] + (i === 0 ? RECOMMENDED_SUFFIX : '')),
        header: 'Polish',
      })
      const picked = order.find(a => choice.startsWith(CHOICES[a])) ?? recommended
      this.report.trace(`dialog: recommended=${recommended} picked=${picked}`)
      return picked
    } catch {
      this.report.note('dialog dismissed, sent original')
      return null
    }
  }

  private async callFast(): Promise<Parsed | null> {
    const startedAt = Date.now()
    const r = await this.deps.complete({
      model: this.cfg.fastModel,
      system: this.input.source === 'voice' ? FAST_SYSTEM_VOICE : FAST_SYSTEM_TYPED,
      prompt: asData(this.input.text),
      effort: this.cfg.fastEffort,
      maxTokens: FAST_MAX_TOKENS,
      timeoutMs: FAST_TIMEOUT_MS,
    })
    if (!r.isAnswered) {
      this.report.note(`model failed (${r.reason}), sent original`)
      return null
    }
    const parsed = parse(r.text)
    if (!parsed) this.report.note('unusable reply, sent original')
    else this.report.trace(`fast reply (${this.cfg.fastModel}, ${this.input.source}): action=${parsed.action ?? 'none'} confidence=${parsed.confidence} ms=${Date.now() - startedAt}`)
    return parsed
  }

  private async callImprove(text: string): Promise<Parsed | null> {
    this.report.progress(`improving with ${this.cfg.improveModel}...`)
    const r = await this.deps.complete({
      model: this.cfg.improveModel,
      system: IMPROVE_SYSTEM,
      prompt: asData(text),
      effort: this.cfg.improveEffort,
      maxTokens: IMPROVE_MAX_TOKENS,
      timeoutMs: IMPROVE_TIMEOUT_MS,
    })
    return r.isAnswered ? parse(r.text) : null
  }

  /** The rewritten prompt, with the original kept for the agent in a hidden note. */
  private deliver(text: string, note: string): Outcome {
    const fallback = 'If the rewrite seems to miss the intent, work from the original.'
    return { text, context: [...(this.input.context ?? []), `${note} ${fallback}`] }
  }
}

/**
 * Decides what the agent receives for one submitted prompt. Never throws: any failure
 * means `null`, the original prompt.
 */
export const polish = (deps: Deps, cfg: Settings, input: Input): Promise<Outcome> => new Polisher(deps, cfg, input).run()

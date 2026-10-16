import type { ModelCompleteRequest, ModelCompleteResult } from 'claude-code'

/** What the decision logic needs from the engine. The hook wires the real `$`; tests wire fakes. */
export type Deps = {
  complete: (req: ModelCompleteRequest) => Promise<ModelCompleteResult>
  ask: (question: string, options: { options: readonly string[]; header: string }) => Promise<string>
  /** A transcript line. */
  log: (text: string) => void
  /** The short, self-clearing status. */
  flash: (text: string) => void
}

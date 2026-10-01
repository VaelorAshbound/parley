import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

// The scripted AI for the fast e2e tests (spec §6: "a scripted fake LLM, so
// it is fast and gives the same result every run"). createModel picks it on a
// Preview or in local dev when the browser sends its cookie; never in
// production. It keeps no state: each call reads the chat so far, finds the
// script for the user's last message, and plays the step after the ones it
// already played. The e2e tests type these phrases.

type Options = Parameters<MockLanguageModelV4["doStream"]>[0]
type Part =
  Awaited<
    ReturnType<MockLanguageModelV4["doStream"]>
  >["stream"] extends ReadableStream<infer P>
    ? P
    : never

/** One model step: text and/or tool calls, in order. */
type Step = ({ text: string } | { tool: string; input: unknown })[]

/** The scripts, each for the messages its phrase matches. */
export const scripts: {
  when: RegExp
  steps: Step[]
  /** Time between the stream's chunks; 20 ms unless a test needs a slow turn. */
  chunkDelayInMs?: number
}[] = [
  {
    // A turn slow enough to reload the page in the middle of (PAR-33):
    // the first sentence, then a second a few seconds later.
    when: /\bslow reply\b/i,
    chunkDelayInMs: 1000,
    steps: [
      [
        { text: "Here is the slow reply, saved while you were away." },
        { text: " It goes on after the reload." },
      ],
    ],
  },
  {
    // Stories 1, 2 and 5: picks an agreement, fills a field (a change with
    // Undo), and explains.
    when: /\broadmap\b/i,
    steps: [
      [
        {
          tool: "chooseDocument",
          input: {
            documentId: "mutual-nda",
            reason: "You'll both share confidential plans.",
          },
        },
      ],
      [
        {
          tool: "updateFields",
          input: {
            changes: [
              {
                key: "purpose",
                value: "Sharing our product roadmap with a vendor.",
                explanation: "What the shared information may be used for.",
              },
            ],
          },
        },
      ],
      [{ text: "I picked the Mutual NDA and filled in the purpose." }],
    ],
  },
  {
    // Story 2: a suggestion that names the related agreements.
    when: /\bcloud software\b/i,
    steps: [
      [
        {
          tool: "chooseDocument",
          input: {
            documentId: "csa",
            reason:
              "You sell cloud software; a CSA usually comes with an SLA and a DPA.",
          },
        },
      ],
      [{ text: "I picked the Cloud Service Agreement." }],
    ],
  },
  {
    // Story 3: a questionnaire with a choice, a typed answer and a skip.
    when: /\bask me\b/i,
    steps: [
      [
        {
          tool: "askQuestions",
          input: {
            title: "Key terms",
            questions: [
              {
                name: "term",
                prompt: "How long should the agreement last?",
                required: true,
                multiple: false,
                choices: [
                  { value: "1y", label: "1 year" },
                  { value: "open", label: "Until one side ends it" },
                ],
              },
              {
                name: "company",
                prompt: "What is your company called?",
                required: true,
                multiple: false,
                choices: [],
              },
              {
                name: "notes",
                prompt: "Anything else to add?",
                required: false,
                multiple: false,
                choices: [],
              },
            ],
          },
        },
      ],
      [{ text: "Thanks, that's everything I needed." }],
    ],
  },
]

const fallback: Step[] = [[{ text: "I'm a scripted reply for tests." }]]

function nextStep(prompt: Options["prompt"]): {
  step: Step
  chunkDelayInMs: number
} {
  const lastUser = prompt.findLastIndex((message) => message.role === "user")
  const user = prompt[lastUser]
  const text =
    user?.role === "user"
      ? user.content
          .flatMap((part) => (part.type === "text" ? [part.text] : []))
          .join(" ")
      : ""
  const { steps, chunkDelayInMs = 20 } = scripts.find(({ when }) =>
    when.test(text)
  ) ?? { steps: fallback }
  const played = prompt
    .slice(lastUser + 1)
    .filter((message) => message.role === "assistant").length
  // Past the end: the script is done, so the turn ends with no more calls.
  return { step: steps[played] ?? [{ text: "Done." }], chunkDelayInMs }
}

function toParts(step: Step): Part[] {
  return step.flatMap((part, index): Part[] =>
    "text" in part
      ? [
          { type: "text-start", id: `t${index}` },
          { type: "text-delta", id: `t${index}`, delta: part.text },
          { type: "text-end", id: `t${index}` },
        ]
      : [
          {
            type: "tool-call",
            toolCallId: `scripted-${crypto.randomUUID()}`,
            toolName: part.tool,
            input: JSON.stringify(part.input),
          },
        ]
  )
}

export function scriptedModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    modelId: "scripted",
    doStream: async ({ prompt }) => {
      const { step, chunkDelayInMs } = nextStep(prompt)
      const calls = step.some((part) => "tool" in part)
      return {
        stream: simulateReadableStream({
          // A little delay, so the UI's streaming states show as they would.
          chunkDelayInMs,
          chunks: [
            ...toParts(step),
            {
              type: "finish",
              finishReason: {
                unified: calls ? "tool-calls" : "stop",
                raw: undefined,
              },
              usage: {
                inputTokens: {
                  total: 0,
                  noCache: 0,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 0, text: 0, reasoning: undefined },
              },
              // Free, and said so: a missing cost reads as OpenRouter not
              // reporting one (metrics.ts).
              providerMetadata: { openrouter: { usage: { cost: 0 } } },
            },
          ],
        }),
      }
    },
  })
}

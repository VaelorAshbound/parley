import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { createChat } from "@shadcn/helpers/ai-sdk"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { applyFieldChanges, definitions } from "@workspace/documents"
import { ORPCError } from "@orpc/client"
import type { ChatTransport } from "ai"
import { useEffect, type ReactNode } from "react"
import { describe, expect, test, vi } from "vite-plus/test"
import { userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { UiStoreProvider, useUiStore } from "@/lib/ui-store"
import type { ChatMessage } from "@/server/ai/chat"
import type { Router } from "@/server/rpc/router"

import { ChatPanel } from "./chat-panel"

// The chat with scripted conversations (spec §6: @shadcn/helpers createChat
// through the real useChat, no network).

const nda = definitions["mutual-nda"]
const draftId = "0199c0de-0000-7000-8000-000000000002"
// Only the query keys are used; the scripted transport answers the chat.
const unused = async () => {
  throw new Error("not called in these tests")
}
// updateFields runs the real engine on a copy of the draft, as the server
// would (the Undo tests).
let server: Record<string, unknown> = {}
let serverChat: ChatMessage[] = []
// drafts.get answers when a test lets it (the draft loading again after the
// AI picks an agreement); the other tests never call it.
let loadDraft: () => Promise<unknown> = unused
const orpc = createTanstackQueryUtils({
  drafts: {
    get: () => loadDraft(),
    list: unused,
    updateFields: async ({
      changes,
    }: {
      changes: { key: string; value: unknown; expected?: unknown }[]
    }) => {
      const result = applyFieldChanges(nda, server, changes)
      server = result.values
      return {
        ...result,
        draft: { id: draftId, documentId: "mutual-nda", fields: server },
      }
    },
  },
  // The server's copy of the chat, for the tests that read it back.
  chat: { messages: async () => serverChat, send: unused },
} as unknown as RouterClient<Router>)
const draftKey = orpc.drafts.get.queryKey({ input: { id: draftId } })

const purpose = "Sharing our product roadmap with a vendor."
const conversation = () =>
  createChat<ChatMessage>()
    .user("We share a roadmap with a vendor.")
    .assistant(({ writer }) => {
      writer
        .tool("chooseDocument", {
          input: { documentId: "mutual-nda", reason: "Both sides share." },
        })
        .output({
          documentId: "mutual-nda",
          title: "Mutual Non-Disclosure Agreement",
        })
      writer
        .tool("updateFields", {
          input: {
            changes: [
              { key: "purpose", value: purpose, explanation: "Why you share." },
            ],
          },
        })
        .output({
          applied: [
            {
              key: "purpose",
              before: undefined,
              after: purpose,
              explanation: "Why you share.",
            },
          ],
          rejected: [],
          inverse: [{ key: "purpose", value: null, expected: purpose }],
        })
      writer.text("A **Mutual NDA** fits: you both share plans.")
    })

/** Reads the UI store from inside the provider, for the assertions. */
let store: { changed: Record<string, number> } = { changed: {} }
function Peek() {
  const changed = useUiStore((state) => state.changed)
  useEffect(() => {
    store.changed = changed
  }, [changed])
  return null
}

async function show({
  initialMessages = [],
  pending,
  children,
  script = conversation(),
  transport = (base) => base,
  documentId = "mutual-nda",
  height,
}: {
  initialMessages?: ChatMessage[]
  pending?: string
  children?: ReactNode
  script?: ReturnType<typeof conversation>
  /** Wraps the scripted transport, to make a request fail. */
  transport?: (base: ChatTransport<ChatMessage>) => ChatTransport<ChatMessage>
  /** null: a new draft, before the AI picks its agreement. */
  documentId?: string | null
  /** Puts the chat in a box this tall (px), as on the page, so it scrolls. */
  height?: number
} = {}) {
  server = {}
  store = { changed: {} }
  const queryClient = new QueryClient()
  queryClient.setQueryData(draftKey, {
    id: draftId,
    documentId,
    fields: {},
  } as never)
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <UiStoreProvider>
        {pending && <Pending text={pending} />}
        <Peek />
        <div className="flex flex-col" style={{ height }}>
          <ChatPanel
            draftId={draftId}
            initialMessages={initialMessages}
            definition={nda}
            transport={transport(script.transport({ delayMs: 0 }))}
            orpc={orpc}
          />
        </div>
        {children}
      </UiStoreProvider>
    </QueryClientProvider>
  )
  return { screen, queryClient }
}

function Pending({ text }: { text: string }) {
  const setPending = useUiStore((state) => state.setPending)
  useEffect(() => setPending({ draftId, text }), [setPending, text])
  return null
}

describe("the chat", () => {
  test("sends on Enter and streams the reply, its pick and its changes", async () => {
    const { screen } = await show()

    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "We share a roadmap with a vendor.{Enter}"
    )

    await expect
      .element(screen.getByText("We share a roadmap with a vendor."))
      .toBeVisible()
    await expect.element(screen.getByText("Mutual NDA selected")).toBeVisible()
    const changes = screen.getByRole("list", {
      name: "Changes to the document",
    })
    await expect.element(changes).toBeVisible()
    expect(changes.element().textContent).toContain(`Purpose→set to${purpose}`)
    await expect
      .element(screen.getByText("Mutual NDA", { exact: true }))
      .toHaveProperty("tagName", "STRONG")
  })

  test("keeps a line break on Shift+Enter instead of sending", async () => {
    const { screen } = await show()
    const box = screen.getByRole("textbox", { name: "Message" })

    await userEvent.type(box, "One{Shift>}{Enter}{/Shift}Two")

    await expect.element(box).toHaveValue("One\nTwo")
  })

  test("shows each change in the live document when its result arrives", async () => {
    const { screen, queryClient } = await show()
    using invalidate = vi.spyOn(queryClient, "invalidateQueries")

    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "We share a roadmap with a vendor.{Enter}"
    )

    await expect
      .poll(() => queryClient.getQueryData(draftKey)?.fields)
      .toEqual({ purpose })
    // A new agreement changes every field, so the draft loads again.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: draftKey })
  })

  test("sends the first message typed on the home page", async () => {
    const { screen } = await show({
      pending: "We share a roadmap with a vendor.",
    })

    await expect.element(screen.getByText("Mutual NDA selected")).toBeVisible()
  })

  test("doesn't apply changes again that were there when the page loaded", async () => {
    const earlier = conversation().get()
    const { queryClient } = await show({ initialMessages: earlier })

    expect(queryClient.getQueryData(draftKey)?.fields).toEqual({})
  })

  test("marks what changed this turn, and settles it on the next message", async () => {
    const { screen } = await show()
    const box = screen.getByRole("textbox", { name: "Message" })

    await userEvent.type(box, "We share a roadmap with a vendor.{Enter}")
    await expect.poll(() => store.changed).toEqual({ purpose: 1 })

    await userEvent.type(box, "Thanks.{Enter}")
    await expect.poll(() => store.changed).toEqual({})
  })

  test("undoes an AI change: the value goes back, and the row says so", async () => {
    const { screen, queryClient } = await show()
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "We share a roadmap with a vendor.{Enter}"
    )
    await expect
      .poll(() => queryClient.getQueryData(draftKey)?.fields)
      .toEqual({ purpose })
    server = { purpose }

    await screen.getByRole("button", { name: "Undo Purpose" }).click()

    expect(queryClient.getQueryData(draftKey)?.fields).toEqual({})
    await expect.element(screen.getByText("Undone")).toBeVisible()
    await expect.poll(() => server).toEqual({})
  })

  test("an Undo pressed while the picked agreement loads waits for it, then undoes", async () => {
    // A new draft: the AI picks the agreement in this turn, so the page
    // loads the draft again, slowly (a Preview far away; CI's WebKit).
    let loaded = () => {}
    loadDraft = () =>
      new Promise((resolve) => {
        loaded = () =>
          resolve({
            id: draftId,
            documentId: "mutual-nda",
            fields: { purpose },
          })
      })
    const { screen, queryClient } = await show({ documentId: null })
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "We share a roadmap with a vendor.{Enter}"
    )
    server = { purpose }

    await screen.getByRole("button", { name: /Undo Purpose/i }).click()
    loaded()

    await expect.element(screen.getByText("Undone")).toBeVisible()
    await expect.poll(() => server).toEqual({})
    expect(queryClient.getQueryData(draftKey)?.fields).toEqual({})
    loadDraft = unused
  })

  test("won't undo over a newer edit, and says the field changed since", async () => {
    const { screen, queryClient } = await show()
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "We share a roadmap with a vendor.{Enter}"
    )
    await expect
      .poll(() => queryClient.getQueryData(draftKey)?.fields)
      .toEqual({ purpose })
    // The user edits the purpose by hand after the AI.
    queryClient.setQueryData(draftKey, (draft) =>
      draft ? { ...draft, fields: { purpose: "My own words." } } : draft
    )

    await screen.getByRole("button", { name: "Undo Purpose" }).click()

    await expect.element(screen.getByText("Changed since")).toBeVisible()
    expect(queryClient.getQueryData(draftKey)?.fields).toEqual({
      purpose: "My own words.",
    })
  })

  test("asks with a questionnaire, sends the answers, and goes on", async () => {
    const questions = {
      title: "Key terms",
      questions: [
        {
          name: "term",
          prompt: "How long should the NDA last?",
          required: true,
          choices: [
            { value: "1y", label: "1 year" },
            { value: "2y", label: "2 years" },
          ],
          multiple: false,
        },
      ],
    }
    let heard: unknown
    const script = createChat<ChatMessage>()
      .user("Help me with the terms.")
      .assistant(({ writer }) => {
        writer.tool("askQuestions", { input: questions })
      })
      .assistant(({ writer, toolCall }) => {
        heard = toolCall?.output
        writer.text("Two years it is.")
      })
    const { screen } = await show({ script })

    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Help me with the terms.{Enter}"
    )
    await expect
      .element(
        screen.getByRole("group", { name: "How long should the NDA last?" })
      )
      .toBeVisible()
    await userEvent.keyboard("b")
    await screen.getByRole("button", { name: "Send answers" }).click()

    await expect.element(screen.getByText("Two years it is.")).toBeVisible()
    expect(heard).toEqual({ answers: { term: ["2y"] } })
    // Taken by the server: nothing is left to resume.
    await expect
      .poll(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("parley:questions:")
        )
      )
      .toEqual([])
    await expect
      .element(screen.getByText("Key terms answered ·", { exact: false }))
      .toHaveTextContent("Key terms answered · 2 years")
  })

  test("sending the answers leaves the cursor in the reply box", async () => {
    const script = createChat<ChatMessage>()
      .user("Help me with the terms.")
      .assistant(({ writer }) => {
        writer.tool("askQuestions", {
          input: {
            title: "Key terms",
            questions: [
              {
                name: "term",
                prompt: "How long should the NDA last?",
                required: true,
                choices: [
                  { value: "1y", label: "1 year" },
                  { value: "2y", label: "2 years" },
                ],
                multiple: false,
              },
            ],
          },
        })
      })
      .assistant(({ writer }) => {
        writer.text("Two years it is.")
      })
    const { screen } = await show({ script })
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Help me with the terms.{Enter}"
    )
    await expect
      .element(
        screen.getByRole("group", { name: "How long should the NDA last?" })
      )
      .toBeVisible()

    // Only keys: pick, then Enter sends the answers.
    await userEvent.keyboard("b")
    await userEvent.keyboard("{Enter}")

    await expect.element(screen.getByText("Two years it is.")).toBeVisible()
    // Not dropped to <body> with the questionnaire (T36).
    await expect
      .element(screen.getByRole("textbox", { name: "Message" }))
      .toHaveFocus()
  })

  test("brings the questions back, answers kept, when the server refuses them", async () => {
    const set = {
      title: "Deal parties",
      questions: [
        {
          name: "company",
          prompt: "What is your company's legal name?",
          required: true,
          choices: [],
          multiple: false,
        },
      ],
    }
    const script = createChat<ChatMessage>()
      .user("Help me.")
      .assistant(({ writer }) => {
        writer.tool("askQuestions", { input: set })
      })
    const asked = script.get()
    serverChat = asked
    const { screen } = await show({
      initialMessages: asked,
      script,
      // The answers never get past the server.
      transport: (base) => ({
        ...base,
        sendMessages: async () => {
          throw new ORPCError("INVALID_ANSWERS", {
            message: "Those answers don't fit the questions.",
          })
        },
      }),
    })

    await userEvent.type(
      screen.getByRole("textbox", {
        name: "What is your company's legal name?",
      }),
      "Acme Robotics"
    )
    await screen.getByRole("button", { name: "Send answers" }).click()

    await expect
      .element(
        screen.getByRole("textbox", {
          name: "What is your company's legal name?",
        })
      )
      .toHaveValue("Acme Robotics")
    expect(
      screen.getByText("Parley couldn’t answer.", { exact: false }).query()
    ).toBeNull()
  })

  test("Try again after a failed answer turn sends the answers again (PAR-7)", async () => {
    const script = createChat<ChatMessage>()
      .user("Help me with the terms.")
      .assistant(({ writer }) => {
        writer.tool("askQuestions", {
          input: {
            title: "Key terms",
            questions: [
              {
                name: "term",
                prompt: "How long should the NDA last?",
                required: true,
                choices: [
                  { value: "1y", label: "1 year" },
                  { value: "2y", label: "2 years" },
                ],
                multiple: false,
              },
            ],
          },
        })
      })
      .assistant(({ writer }) => {
        writer.text("Two years it is.")
      })
    const sent: { last?: ChatMessage; body?: object }[] = []
    const { screen } = await show({
      script,
      // The first answers fail on the way, as a provider error would.
      transport: (base) => ({
        ...base,
        sendMessages: async (options) => {
          sent.push({ last: options.messages.at(-1), body: options.body })
          if (sent.length === 2) throw new Error("The provider went away.")
          return base.sendMessages(options)
        },
      }),
    })
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Help me with the terms.{Enter}"
    )
    await expect
      .element(
        screen.getByRole("group", { name: "How long should the NDA last?" })
      )
      .toBeVisible()
    await userEvent.keyboard("b")
    await screen.getByRole("button", { name: "Send answers" }).click()
    await expect
      .element(screen.getByText("Parley couldn’t answer.", { exact: false }))
      .toBeVisible()

    await screen.getByRole("button", { name: "Try again" }).click()

    await expect.element(screen.getByText("Two years it is.")).toBeVisible()
    // The answers went again, said to be a retry, not the first message.
    expect(sent).toHaveLength(3)
    expect(sent[2]?.last?.role).toBe("assistant")
    expect(sent[2]?.last?.parts).toContainEqual(
      expect.objectContaining({
        type: "tool-askQuestions",
        state: "output-available",
        output: { answers: { term: ["2y"] } },
      })
    )
    expect(sent[2]?.body).toEqual({ retry: true })
    await expect
      .element(screen.getByText("Key terms answered ·", { exact: false }))
      .toHaveTextContent("Key terms answered · 2 years")
  })

  /** A chat whose sends the server refuses with `error`. */
  function refusing(error: ORPCError<string, unknown>) {
    return show({
      transport: (base) => ({
        ...base,
        sendMessages: async () => {
          throw error
        },
      }),
    })
  }

  test("says when a guest has used the day's messages, and offers an account", async () => {
    const { screen } = await refusing(
      new ORPCError("DAILY_LIMIT", {
        defined: true,
        status: 429,
        data: { limit: 20, tier: "guest", resetsAt: "2026-09-26T00:00:00Z" },
      })
    )

    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "One more thing{Enter}"
    )

    await expect
      .element(
        screen.getByText("You’ve used today’s 20 messages.", { exact: false })
      )
      .toBeVisible()
    await expect
      .element(screen.getByRole("link", { name: "Create an account" }))
      .toHaveAttribute(
        "href",
        `/sign-up?redirect=${encodeURIComponent(`/d/${draftId}`)}`
      )
    expect(screen.getByRole("button", { name: "Try again" }).query()).toBeNull()
    expect(
      screen.getByText("Parley couldn’t answer.", { exact: false }).query()
    ).toBeNull()
  })

  test("asks to slow down after a burst, and can try again", async () => {
    const { screen } = await refusing(
      new ORPCError("TOO_MANY_REQUESTS", { defined: true, status: 429 })
    )

    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Quick{Enter}"
    )

    await expect
      .element(
        screen.getByText("You’re sending messages quickly.", { exact: false })
      )
      .toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible()
  })
})

describe("a page loaded while Parley answers (PAR-33)", () => {
  const question: ChatMessage = {
    id: "user-reloaded",
    role: "user",
    parts: [{ type: "text", text: "We share a roadmap with a vendor." }],
    // Saved a moment ago, by the page that was reloaded away.
    metadata: { savedAt: Date.now() },
  }
  const saved: ChatMessage = {
    id: "reply-reloaded",
    role: "assistant",
    parts: [{ type: "text", text: "A **Mutual NDA** fits." }],
  }

  test("says Parley is still answering, then shows the reply once it is saved", async () => {
    // The reply is still streaming to the page that was reloaded away.
    serverChat = [question]
    const { screen, queryClient } = await show({ initialMessages: [question] })

    await expect.element(screen.getByText("Thinking…")).toBeVisible()
    serverChat = [question, saved]

    await expect
      .element(screen.getByText("Mutual NDA", { exact: true }), {
        timeout: 5000,
      })
      .toBeVisible()
    expect(screen.getByText("Thinking…").query()).toBeNull()
    // The next visit starts from it too.
    expect(
      queryClient.getQueryData(
        orpc.chat.messages.queryKey({ input: { id: draftId } })
      )
    ).toEqual([question, saved])
    serverChat = []
  })

  test("a turn that died long ago offers Try again at once, and the box works", async () => {
    // A provider error before Parley's first word, days ago: the chat ends
    // with the user's message, and no reply is coming.
    const old = { ...question, metadata: { savedAt: Date.now() - 86_400_000 } }
    serverChat = [old]
    const { screen } = await show({ initialMessages: [old] })

    await expect
      .element(screen.getByText("Parley couldn’t answer.", { exact: false }))
      .toBeVisible()
    expect(screen.getByText("Thinking…").query()).toBeNull()
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Still there?"
    )
    await expect
      .element(screen.getByRole("button", { name: "Send" }))
      .toBeEnabled()

    // Try again asks for the reply to that message.
    await screen.getByRole("button", { name: "Try again" }).click()
    await expect.element(screen.getByText("Mutual NDA selected")).toBeVisible()
    expect(
      screen.getByText("Parley couldn’t answer.", { exact: false }).query()
    ).toBeNull()
    serverChat = []
  })
})

describe("a reply cut short (PAR-47)", () => {
  const question: ChatMessage = {
    id: "user-stopped",
    role: "user",
    parts: [{ type: "text", text: "We share a roadmap with a vendor." }],
    metadata: { savedAt: Date.now() - 60_000 },
  }
  // As the server saved it: the words so far, then its mark.
  const stopped: ChatMessage = {
    id: "reply-stopped",
    role: "assistant",
    parts: [
      { type: "step-start" },
      { type: "text", text: "A Mutual NDA fits, as you", state: "done" },
      { type: "data-interrupted", data: {} },
    ],
    metadata: { savedAt: Date.now() - 59_000 },
  }

  test("says Stopped after a reload, and Try again asks for the whole reply", async () => {
    const sent: (ChatMessage | undefined)[] = []
    const { screen } = await show({
      initialMessages: [question, stopped],
      transport: (base) => ({
        ...base,
        sendMessages: async (options) => {
          sent.push(options.messages.at(-1))
          return base.sendMessages(options)
        },
      }),
    })

    await expect.element(screen.getByText("Stopped")).toBeVisible()
    await screen.getByRole("button", { name: "Try again" }).click()

    await expect.element(screen.getByText("Mutual NDA selected")).toBeVisible()
    // useChat's regenerate: the same question again, the cut reply gone.
    expect(sent.map((message) => message?.id)).toEqual([question.id])
    expect(screen.getByText("A Mutual NDA fits, as you").query()).toBeNull()
    expect(screen.getByText("Stopped").query()).toBeNull()
  })

  test("is only a label on an earlier reply: Try again is the latest turn's", async () => {
    const later: ChatMessage[] = [
      {
        ...question,
        id: "user-later",
        parts: [{ type: "text", text: "Go on." }],
      },
      {
        id: "reply-later",
        role: "assistant",
        parts: [{ type: "text", text: "Here is the rest.", state: "done" }],
      },
    ]
    const { screen } = await show({
      initialMessages: [question, stopped, ...later],
    })

    await expect.element(screen.getByText("Stopped")).toBeVisible()
    expect(screen.getByRole("button", { name: "Try again" }).query()).toBeNull()
  })

  test("says Stopped at once when the reply is stopped here", async () => {
    // A reply that writes a few words, then waits until it is stopped.
    const { screen } = await show({
      transport: () => ({
        sendMessages: async ({ abortSignal }) =>
          new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "start", messageId: "reply-live" })
              controller.enqueue({ type: "start-step" })
              controller.enqueue({ type: "text-start", id: "t" })
              controller.enqueue({
                type: "text-delta",
                id: "t",
                delta: "A Mutual NDA fits",
              })
              abortSignal?.addEventListener("abort", () =>
                controller.error(abortSignal.reason)
              )
            },
          }),
        reconnectToStream: async () => null,
      }),
    })
    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "We share a roadmap with a vendor.{Enter}"
    )
    await expect.element(screen.getByText("A Mutual NDA fits")).toBeVisible()
    expect(screen.getByText("Stopped").query()).toBeNull()

    await screen.getByRole("button", { name: "Stop" }).click()

    await expect.element(screen.getByText("Stopped")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeVisible()
  })

  test("a stopped questionnaire, once answered, goes on and isn't Stopped", async () => {
    // Stopped (or reloaded) after the questions came, before the turn ended.
    const asked: ChatMessage = {
      id: "reply-asked",
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-askQuestions",
          toolCallId: "ask-1",
          state: "input-available",
          input: {
            title: "Key terms",
            questions: [
              {
                name: "term",
                prompt: "How long should the NDA last?",
                required: true,
                choices: [
                  { value: "1y", label: "1 year" },
                  { value: "2y", label: "2 years" },
                ],
                multiple: false,
              },
            ],
          },
        },
        { type: "data-interrupted", data: {} },
      ],
    }
    let finish = () => {}
    const sent: (ChatMessage | undefined)[] = []
    const { screen } = await show({
      initialMessages: [
        { ...question, parts: [{ type: "text", text: "The terms?" }] },
        asked,
      ],
      // The same reply goes on: it updates the document, then answers.
      transport: () => ({
        sendMessages: async ({ messages }) => {
          sent.push(messages.at(-1))
          return new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "start", messageId: asked.id })
              controller.enqueue({ type: "start-step" })
              controller.enqueue({
                type: "tool-input-available",
                toolCallId: "update-1",
                toolName: "updateFields",
                input: {
                  changes: [
                    { key: "term", value: "2 years", explanation: "Asked." },
                  ],
                },
              })
              finish = () => {
                controller.enqueue({ type: "text-start", id: "t" })
                controller.enqueue({
                  type: "text-delta",
                  id: "t",
                  delta: "Two years it is.",
                })
                controller.enqueue({ type: "text-end", id: "t" })
                controller.enqueue({ type: "finish-step" })
                controller.enqueue({ type: "finish" })
                controller.close()
              }
            },
          })
        },
        reconnectToStream: async () => null,
      }),
    })
    await expect.element(screen.getByText("Stopped")).toBeVisible()
    await screen.getByRole("radio", { name: "2 years" }).click()
    await screen.getByRole("button", { name: "Send answers" }).click()

    // At work again: what it does shows, as in any turn.
    await expect
      .element(screen.getByText("Updating the document…"))
      .toBeVisible()
    finish()

    await expect.element(screen.getByText("Two years it is.")).toBeVisible()
    expect(screen.getByText("Stopped").query()).toBeNull()
    // The server is never told of the old mark either.
    expect(sent[0]?.parts.map((part) => part.type)).not.toContain(
      "data-interrupted"
    )
  })
})

describe("a long chat", () => {
  /** Twenty turns saved before this visit. */
  const history = (): ChatMessage[] =>
    Array.from({ length: 20 }, (_, turn): ChatMessage[] => [
      {
        id: `user-${turn}`,
        role: "user",
        parts: [{ type: "text", text: `Question ${turn} about the deal.` }],
      },
      {
        id: `reply-${turn}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Answer ${turn}. ${"The clause stays as it is. ".repeat(12)}`,
          },
        ],
      },
    ]).flat()

  test("stays at the end when the day's limit refuses a send, the note in view (PAR-34)", async () => {
    const { screen } = await show({
      height: 600,
      initialMessages: history(),
      transport: (base) => ({
        ...base,
        // Refused after a moment, as over the network.
        sendMessages: async () => {
          await new Promise((resolve) => setTimeout(resolve, 150))
          throw new ORPCError("DAILY_LIMIT", {
            defined: true,
            status: 429,
            data: {
              limit: 100,
              tier: "free",
              resetsAt: "2026-09-26T00:00:00Z",
            },
          })
        },
      }),
    })
    await expect
      .element(screen.getByText("Answer 19.", { exact: false }))
      .toBeInViewport()

    await userEvent.type(
      screen.getByRole("textbox", { name: "Message" }),
      "One more thing{Enter}"
    )
    const upgrade = screen.getByRole("link", { name: "Get Pro" })
    await expect.element(upgrade).toBeVisible()
    // Past the frames in which the scroller settles after the note appears.
    await new Promise((resolve) => setTimeout(resolve, 500))

    await expect.element(upgrade).toBeInViewport()
    await expect.element(screen.getByText("One more thing")).toBeInViewport()
  })
})

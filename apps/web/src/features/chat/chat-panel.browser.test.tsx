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
const orpc = createTanstackQueryUtils({
  drafts: {
    get: unused,
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
}: {
  initialMessages?: ChatMessage[]
  pending?: string
  children?: ReactNode
  script?: ReturnType<typeof conversation>
  /** Wraps the scripted transport, to make a request fail. */
  transport?: (base: ChatTransport<ChatMessage>) => ChatTransport<ChatMessage>
} = {}) {
  server = {}
  store = { changed: {} }
  const queryClient = new QueryClient()
  queryClient.setQueryData(draftKey, {
    id: draftId,
    documentId: "mutual-nda",
    fields: {},
  } as never)
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <UiStoreProvider>
        {pending && <Pending text={pending} />}
        <Peek />
        <ChatPanel
          draftId={draftId}
          initialMessages={initialMessages}
          definition={nda}
          transport={transport(script.transport({ delayMs: 0 }))}
          orpc={orpc}
        />
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

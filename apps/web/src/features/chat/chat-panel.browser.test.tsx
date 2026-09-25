import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { createChat } from "@shadcn/helpers/ai-sdk"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { definitions } from "@workspace/documents"
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
const orpc = createTanstackQueryUtils({
  drafts: { get: unused, list: unused },
  chat: { messages: unused, send: unused },
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

async function show({
  initialMessages = [],
  pending,
  children,
}: {
  initialMessages?: ChatMessage[]
  pending?: string
  children?: ReactNode
} = {}) {
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
        <ChatPanel
          draftId={draftId}
          initialMessages={initialMessages}
          definition={nda}
          transport={conversation().transport({ delayMs: 0 })}
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
})

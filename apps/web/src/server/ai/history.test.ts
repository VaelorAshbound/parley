import { describe, expect, test } from "vite-plus/test"

import { recent } from "./history"

const message = (id: string, text: string) => ({
  id,
  role: "user" as const,
  parts: [{ type: "text" as const, text }],
})

describe("the history the model sees", () => {
  test("keeps only the last messages", () => {
    const chat = ["a", "b", "c", "d"].map((id) => message(id, id))

    const kept = recent(chat, { messages: 2, characters: 10_000 })

    expect(kept.map((each) => each.id)).toEqual(["c", "d"])
  })

  test("drops the oldest messages past the size budget", () => {
    const chat = [
      message("old", "x".repeat(300)),
      message("mid", "y".repeat(300)),
      message("new", "z".repeat(300)),
    ]

    const kept = recent(chat, { messages: 10, characters: 800 })

    expect(kept.map((each) => each.id)).toEqual(["mid", "new"])
  })

  test("always keeps the newest message, even a big one", () => {
    const chat = [message("old", "x"), message("new", "z".repeat(5000))]

    const kept = recent(chat, { messages: 10, characters: 100 })

    expect(kept.map((each) => each.id)).toEqual(["new"])
  })
})

import { describe, expect, test, vi } from "vite-plus/test"
import { renderHook } from "vitest-browser-react"

import { useSearchText } from "./use-search-text"

// The /drafts search box (T22): the text is the user's while they type, the
// URL catches up after a pause, and it can land late.

const pause = () => new Promise((resolve) => setTimeout(resolve, 400))

async function setUp(query?: string) {
  const search = vi.fn<(query: string | undefined) => void>()
  const hook = await renderHook(
    (props?: { query?: string }) => useSearchText(props?.query, search),
    { initialProps: { query } }
  )
  return { search, ...hook }
}

describe("the /drafts search box", () => {
  test("searches once typing pauses, trimmed", async () => {
    const { search, result, act } = await setUp()

    await act(() => result.current.setText("ac"))
    await act(() => result.current.setText("acme "))
    await pause()

    expect(search.mock.calls).toEqual([["acme"]])
    expect(result.current.text).toBe("acme ")
  })

  test("keeps what is typed while the last search is still landing", async () => {
    const { search, result, act, rerender } = await setUp()
    await act(() => result.current.setText("acme"))
    await expect.poll(() => search.mock.calls).toEqual([["acme"]])

    await act(() => result.current.setText("acme bol"))
    await rerender({ query: "acme" })

    expect(result.current.text).toBe("acme bol")
    await expect.poll(() => search.mock.lastCall).toEqual(["acme bol"])
  })

  test("follows the URL on Back and Forward", async () => {
    const { search, result, rerender } = await setUp("acme")

    await rerender({ query: "bolt" })
    expect(result.current.text).toBe("bolt")
    await rerender({ query: undefined })
    expect(result.current.text).toBe("")

    await pause()
    expect(search).not.toHaveBeenCalled()
  })

  test("clearing doesn't bring the old search back", async () => {
    const { search, result, act, rerender } = await setUp("acme")

    await act(() => result.current.clear())
    await rerender({ query: undefined })
    await pause()

    expect(result.current.text).toBe("")
    expect(search).not.toHaveBeenCalled()
  })

  test("clearing drops a search still waiting for its pause", async () => {
    const { search, result, act, rerender } = await setUp("acme")

    await act(() => result.current.setText("acme bolt"))
    await act(() => result.current.clear())
    await rerender({ query: undefined })
    await pause()

    expect(result.current.text).toBe("")
    expect(search).not.toHaveBeenCalled()
  })
})

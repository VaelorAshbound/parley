import { useSuspenseInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import type { DocumentId } from "@workspace/documents"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { MoreHorizontalIcon, SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"

import { updatedLabel } from "@/features/drafts/calendar"
import { DraftMenu } from "@/features/drafts/draft-menu"
import { useCalendar } from "@/features/drafts/use-calendar"
import { useDebouncedValue } from "@/features/drafts/use-debounced-value"
import { documentList, documentName } from "@/lib/documents"
import { QUERY_MAX } from "@/lib/drafts"
import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

// /drafts: every draft, searchable and filtered by agreement (spec §5
// Routing: /drafts?q=&type=). The URL holds the search, so it can be shared
// and survives a reload; a bad value just falls back to none.
const searchSchema = z.object({
  q: z.string().max(QUERY_MAX).optional().catch(undefined),
  type: z
    .custom<DocumentId>((value) =>
      documentList.some((document) => document.id === value)
    )
    .optional()
    .catch(undefined),
})
type Search = z.infer<typeof searchSchema>

/** Drafts per page; "Show more" loads the next. */
const PAGE = 30

function draftsQuery(orpc: Orpc, { q, type }: Search) {
  return orpc.drafts.list.infiniteOptions({
    input: (after: { id: string; updatedAt: Date } | undefined) => ({
      query: q,
      documentId: type,
      after,
      limit: PAGE,
    }),
    initialPageParam: undefined,
    getNextPageParam: (page) => {
      const last = page.at(-1)
      return last && page.length === PAGE
        ? { id: last.id, updatedAt: last.updatedAt }
        : undefined
    },
  })
}

export const Route = createFileRoute("/_app/_authed/drafts")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureInfiniteQueryData(
      draftsQuery(context.orpc, deps)
    ),
  head: () => ({ meta: [{ title: "Drafts · Parley" }] }),
  component: DraftsPage,
  pendingComponent: DraftsPending,
})

const appRoute = getRouteApi("/_app")

const typeItems = [
  { value: null, label: "All agreements" },
  ...documentList.map((document) => ({
    value: document.id,
    label: document.name,
  })),
]

function DraftsPage() {
  const { orpc } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const calendar = useCalendar(appRoute.useLoaderData().calendar)
  const hidden = useUiStore((state) => state.hidden)
  const drafts = useSuspenseInfiniteQuery(draftsQuery(orpc, search))
  const shown = drafts.data.pages.flat().filter((draft) => !hidden[draft.id])

  // What is typed shows at once; the URL (and the search) follows a pause.
  const [text, setText] = useState(search.q ?? "")
  const [urlQuery, setUrlQuery] = useState(search.q)
  if (search.q !== urlQuery) {
    // Back or forward changed the search: the box follows.
    setUrlQuery(search.q)
    if ((search.q ?? "") !== text.trim()) setText(search.q ?? "")
  }
  const typed = useDebouncedValue(text.trim(), 250)
  useEffect(() => {
    if ((typed || undefined) === search.q) return
    void navigate({
      search: (prev) => ({ ...prev, q: typed || undefined }),
      replace: true,
    })
  }, [typed, search.q, navigate])

  const filtered = Boolean(search.q || search.type)
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex h-14 items-center px-3 md:hidden">
        <SidebarTrigger />
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8 md:py-14">
        <h1 className="font-serif text-4xl leading-none tracking-[-0.02em]">
          Drafts
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <InputGroup className="sm:flex-1">
            <InputGroupInput
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={QUERY_MAX}
              placeholder="Search by name, agreement or party"
              aria-label="Search drafts"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <Select
            items={typeItems}
            value={search.type ?? null}
            onValueChange={(value: DocumentId | null) =>
              void navigate({
                search: (prev) => ({ ...prev, type: value ?? undefined }),
              })
            }
          >
            <SelectTrigger aria-label="Agreement" className="sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {typeItems.map((item) => (
                  <SelectItem key={item.label} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {shown.length === 0 ? (
          filtered ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No drafts match</EmptyTitle>
                <EmptyDescription>
                  Try another word, or look in all agreements.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link
                  to="."
                  search={{}}
                  onClick={() => setText("")}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Clear the search
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No drafts yet</EmptyTitle>
                <EmptyDescription>
                  Describe a deal and Parley drafts the agreement with you.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link to="/" className={buttonVariants()}>
                  Start a draft
                </Link>
              </EmptyContent>
            </Empty>
          )
        ) : (
          <ItemGroup aria-label="Drafts" className="gap-1">
            {shown.map((draft) => (
              // shadcn's ItemGroup is a <div role="list">, so its rows
              // take the role too (an <li> needs a <ul>).
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              <Item key={draft.id} role="listitem" className="relative">
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full">
                    {/* The whole row opens the draft; the menu sits above. */}
                    <Link
                      to="/d/$draftId"
                      params={{ draftId: draft.id }}
                      className="truncate outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                    >
                      {draft.title}
                    </Link>
                  </ItemTitle>
                  <ItemDescription>
                    {documentName(draft.documentId)} · Edited{" "}
                    {updatedLabel(draft.updatedAt, calendar)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="relative">
                  <DraftMenu
                    draft={draft}
                    orpc={orpc}
                    canDuplicate
                    align="end"
                    render={<Button variant="ghost" size="icon-sm" />}
                    label={`More for ${draft.title}`}
                  >
                    <MoreHorizontalIcon />
                  </DraftMenu>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}

        {drafts.hasNextPage && (
          <Button
            variant="outline"
            className="self-center"
            disabled={drafts.isFetchingNextPage}
            onClick={() => void drafts.fetchNextPage()}
          >
            {drafts.isFetchingNextPage && <Spinner data-icon="inline-start" />}
            Show more
          </Button>
        )}
      </main>
    </div>
  )
}

// The same frame as the page, so nothing moves when it arrives.
function DraftsPending() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 md:py-14"
      aria-busy="true"
      aria-label="Loading drafts"
    >
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}

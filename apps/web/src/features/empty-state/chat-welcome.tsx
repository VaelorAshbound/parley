import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { LogoMark } from "@/components/logo"

// What a new draft's chat says before the first message: the next step,
// in plain words. A draft started from the library already has its
// agreement, so it offers to fill that one in, by chat or by hand.

export function ChatWelcome({ document }: { document: string | null }) {
  return (
    <Empty className="my-auto">
      <EmptyHeader className="max-w-sm">
        <EmptyMedia>
          <LogoMark className="size-7" />
        </EmptyMedia>
        <EmptyTitle className="font-serif text-question font-medium text-balance">
          {document === null
            ? "Tell Parley about your deal"
            : `Let’s fill in your ${document}`}
        </EmptyTitle>
        <EmptyDescription className="text-pretty text-ink-2">
          {document === null
            ? "Who is it with, and what are you sharing or selling? Parley picks the agreement."
            : "Tell Parley who it’s with and what it’s for. Or click any value in the document to fill it in yourself."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

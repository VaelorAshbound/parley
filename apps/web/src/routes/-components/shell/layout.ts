import type { Layout } from "react-resizable-panels"

// The saved chat/document split. Its own module: the route's loader reads it,
// and anything the loader imports lands in the entry chunk every page loads,
// while the workspace (and the document engine under it) stays in the draft
// route's own chunk.
export const layoutCookie = "draft_layout"
export const defaultLayout: Layout = { chat: 45, document: 55 }

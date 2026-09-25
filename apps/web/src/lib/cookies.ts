import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

import { readBrowserCookie } from "./browser-cookies"

/**
 * A cookie from the page request (SSR) or the browser, for layout choices
 * that must render the same on the server as on the client (no layout
 * shift): the sidebar and the document panel size.
 */
export const readCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name))
  .client(readBrowserCookie)

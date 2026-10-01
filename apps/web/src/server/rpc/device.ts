// A short name for a signed-in device ("Firefox on Linux") from its user
// agent, for the sessions list in settings. Only a label for people: never
// used to decide anything. A parser library would be exact about versions
// we don't show; these few checks cover the browsers people use.

// Order matters: Edge and Opera also say "Chrome", and Chrome says "Safari".
const browsers: [RegExp, string][] = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
]

// iPhones and iPads say "like Mac OS X", and Android says "Linux".
const systems: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
]

function first(list: [RegExp, string][], userAgent: string) {
  return list.find(([pattern]) => pattern.test(userAgent))?.[1]
}

export function describeDevice(userAgent: string | null) {
  const browser = userAgent ? first(browsers, userAgent) : undefined
  const system = userAgent ? first(systems, userAgent) : undefined
  if (!system) return "Unknown browser"
  return `${browser ?? "A browser"} on ${system}`
}

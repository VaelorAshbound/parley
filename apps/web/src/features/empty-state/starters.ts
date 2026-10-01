// First messages that show what Parley does. The chip says it short (the
// approved design, brand.md canvas); a click sends the whole sentence, as a
// person would write it, so the chat has enough to pick the agreement.
export const starters = [
  {
    label: "Sharing a roadmap with a supplier",
    prompt:
      "I’m sharing our product roadmap with a supplier and want it kept confidential.",
  },
  {
    label: "A 60-day paid pilot",
    prompt: "A customer wants a 60-day paid pilot of our software.",
  },
  {
    label: "Beta access for a design partner",
    prompt:
      "We’re giving a design partner early beta access in exchange for feedback.",
  },
  {
    label: "Hiring an agency for a project",
    prompt: "We’re hiring an agency to build our new website.",
  },
] as const satisfies readonly { label: string; prompt: string }[]

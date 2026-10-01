import { cn } from "@workspace/ui/lib/utils"

// The pilcrow mark: its bowl is a speech bubble (brand.md → Logo). The fills
// follow the theme tokens, so it switches to the dark palette on its own.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        className="fill-blue-ink"
        d="M12.6 3V13H8.6L5 15.8L5.6 12.05A5 5 0 0 1 8.5 3Z"
      />
      <path
        className="fill-foreground"
        d="M13.4 3H20V21H17.9V5.1H15.5V21H13.4Z"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark className="size-[1.25em]" />
      <span className="font-serif font-medium tracking-[-0.02em]">Parley</span>
    </span>
  )
}

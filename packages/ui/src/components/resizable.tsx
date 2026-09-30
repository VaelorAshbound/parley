import { cn } from "cn"
import * as React from "react"
import * as ResizablePrimitive from "react-resizable-panels"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

const roundedAttributes = ["aria-valuenow", "aria-valuemin", "aria-valuemax"]

/**
 * A ref that keeps the separator's aria-valuenow (and its min and max) whole
 * percents. The library writes the layout's raw float ("25.881000518798828"),
 * which a screen reader reads out digit by digit, and has no option to round
 * it. The library calls the ref with null on unmount and ignores a returned
 * cleanup, so the observer is disconnected on that null call.
 */
function useRoundedValues() {
  const observer = React.useRef<MutationObserver | null>(null)
  return React.useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!element) return
    const round = () => {
      for (const name of roundedAttributes) {
        const value = element.getAttribute(name)
        if (value === null || value === "") continue
        const rounded = String(Math.round(Number(value)))
        if (rounded !== value) element.setAttribute(name, rounded)
      }
    }
    round()
    observer.current = new MutationObserver(round)
    observer.current.observe(element, {
      attributes: true,
      attributeFilter: roundedAttributes,
    })
  }, [])
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  const roundValues = useRoundedValues()
  return (
    <ResizablePrimitive.Separator
      elementRef={roundValues}
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }

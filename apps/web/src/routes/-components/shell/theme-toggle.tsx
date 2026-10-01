import { SidebarMenuButton } from "@workspace/ui/components/sidebar"
import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"

// The server can't know the theme, so icons and words switch by CSS (the
// theme script sets the class before paint) and the page never mismatches.
export function ThemeToggle() {
  const { setTheme } = useTheme()
  return (
    <SidebarMenuButton
      tooltip="Switch theme"
      onClick={() =>
        setTheme(
          document.documentElement.classList.contains("dark") ? "light" : "dark"
        )
      }
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
      <span className="dark:hidden">Dark theme</span>
      <span className="hidden dark:inline">Light theme</span>
    </SidebarMenuButton>
  )
}

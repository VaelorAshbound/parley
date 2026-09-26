import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"

const themes = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const

/**
 * Light, dark, or the system's (spec §5 UI). The sidebar's switch only
 * flips light and dark; this is the way back to "follow my system".
 */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Appearance</h2>
        </CardTitle>
        <CardDescription>Saved on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup
          aria-label="Theme"
          variant="outline"
          value={[theme]}
          onValueChange={(value: string[]) => {
            const next = themes.find((each) => each.value === value[0])
            if (next) setTheme(next.value)
          }}
        >
          {themes.map(({ value, label, Icon }) => (
            <ToggleGroupItem key={value} value={value}>
              <Icon data-icon="inline-start" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  )
}

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@workspace/cores/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/cores/components/dropdown-menu"
import { useTheme } from "@/components/theme-provider"

const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

type ThemeOption = (typeof themeOptions)[number]["value"]

function isThemeOption(value: string): value is ThemeOption {
  return themeOptions.some((option) => option.value === value)
}

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const ActiveIcon =
    theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Toggle theme" size="icon" variant="outline">
          <ActiveIcon aria-hidden="true" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (isThemeOption(value)) {
              setTheme(value)
            }
          }}
        >
          {themeOptions.map((option) => {
            const Icon = option.icon

            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <Icon aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

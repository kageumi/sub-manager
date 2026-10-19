import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from './Providers.jsx'

export function AppearanceMenu() {
  const { theme, dark, setTheme } = useTheme()
  const Icon = dark ? MoonIcon : SunIcon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="切换外观" />}>
        <Icon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" closeOnClick>
            <SunIcon />
            浅色模式
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" closeOnClick>
            <MoonIcon />
            深色模式
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" closeOnClick>
            <MonitorIcon />
            跟随系统
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

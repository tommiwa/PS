import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/contexts/theme-context"

export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === "bci") {
      setTheme("light")
    } else if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("bci")
    }
  }

  const getThemeTooltip = () => {
    const currentTheme = theme === "system" ? `System (${actualTheme})` : theme.charAt(0).toUpperCase() + theme.slice(1);
    let nextTheme = "";
    
    if (theme === "bci") {
      nextTheme = "Light";
    } else if (theme === "light") {
      nextTheme = "Dark";
    } else if (theme === "dark") {
      nextTheme = "System";
    } else {
      nextTheme = "BCI";
    }
    
    return `Current theme: ${currentTheme}. Click to switch to ${nextTheme} theme.`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="text-primary-foreground hover:text-primary hover:bg-primary-foreground/20"
        >
          {actualTheme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getThemeTooltip()}</p>
      </TooltipContent>
    </Tooltip>
  )
}
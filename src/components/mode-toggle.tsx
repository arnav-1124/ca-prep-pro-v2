"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch by waiting for client mount
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setMounted(true)
    }, 0)
    return () => clearTimeout(handle)
  }, [])

  const currentTheme = theme === "system" ? resolvedTheme : theme
  const isDark = currentTheme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 p-0 bg-transparent hover:bg-transparent border-0 border-transparent shadow-none cursor-pointer flex items-center justify-center"
        aria-label="Toggle theme"
      >
        <span className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 p-0 bg-transparent hover:bg-transparent border-0 border-transparent shadow-none cursor-pointer flex items-center justify-center relative text-foreground hover:text-primary transition-colors duration-200"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative h-5 w-5">
        {/* Sun Icon */}
        <Sun className="h-5 w-5 transition-all duration-2000 ease-in-out rotate-0 scale-100 dark:-rotate-180 dark:scale-0 absolute inset-0 m-auto" />
        {/* Moon Icon */}
        <Moon className="h-5 w-5 transition-all duration-2000 ease-in-out rotate-360 scale-0 dark:rotate-0 dark:scale-100 absolute inset-0 m-auto" />
      </div>
    </Button>
  )
}

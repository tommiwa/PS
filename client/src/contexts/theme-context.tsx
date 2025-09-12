import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "bci" | "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: "light" | "dark"; // The actual applied theme (resolved system preference)
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>("bci");
  const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");

  // Get system theme preference
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  };

  // Apply theme to DOM
  const applyTheme = (themeToApply: "light" | "dark") => {
    const root = document.documentElement;
    
    if (themeToApply === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    setActualTheme(themeToApply);
  };

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme;
    const initialTheme = savedTheme || "bci";
    
    setThemeState(initialTheme);
    
    let resolvedTheme: "light" | "dark";
    if (initialTheme === "system") {
      resolvedTheme = getSystemTheme();
    } else if (initialTheme === "bci") {
      resolvedTheme = "light"; // BCI theme uses light mode as base
    } else {
      resolvedTheme = initialTheme as "light" | "dark";
    }
    
    applyTheme(resolvedTheme);
  }, []);

  // Listen for system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      const systemTheme = e.matches ? "dark" : "light";
      applyTheme(systemTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    
    // Apply current system theme
    applyTheme(getSystemTheme());

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Update theme
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    
    let resolvedTheme: "light" | "dark";
    if (newTheme === "system") {
      resolvedTheme = getSystemTheme();
    } else if (newTheme === "bci") {
      resolvedTheme = "light"; // BCI theme uses light mode as base
    } else {
      resolvedTheme = newTheme as "light" | "dark";
    }
    
    applyTheme(resolvedTheme);
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    actualTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
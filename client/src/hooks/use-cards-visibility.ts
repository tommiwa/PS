import { useState, useEffect } from "react"

export interface UseCardsVisibilityReturn {
  cardsVisible: boolean
  toggleCards: () => void
  setCardsVisible: (visible: boolean) => void
}

export function useCardsVisibility(pageName: string): UseCardsVisibilityReturn {
  const storageKey = `admin-cards-visibility-${pageName}`
  
  // Initialize state with default value (false = hidden)
  const [cardsVisible, setCardsVisible] = useState<boolean>(false)

  // Load initial state from localStorage on mount
  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(storageKey)
      if (storedValue !== null) {
        const parsedValue = JSON.parse(storedValue)
        setCardsVisible(parsedValue)
      }
    } catch (error) {
      console.warn(`Failed to load cards visibility state for ${pageName}:`, error)
      // Fallback to default value (false)
      setCardsVisible(false)
    }
  }, [storageKey])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cardsVisible))
    } catch (error) {
      console.warn(`Failed to save cards visibility state for ${pageName}:`, error)
    }
  }, [cardsVisible, storageKey])

  const toggleCards = () => {
    setCardsVisible(prev => !prev)
  }

  return {
    cardsVisible,
    toggleCards,
    setCardsVisible
  }
}
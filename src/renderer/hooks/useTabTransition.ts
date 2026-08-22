import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useTabTransition — produces a CSS class to apply fade+slide animation when switching tabs.
 *
 * Usage:
 *   const { visibleTab, animClass } = useTabTransition(activeTab)
 *   <div key={visibleTab} className={animClass}>...</div>
 */
export function useTabTransition(activeTab: string, durationMs = 120) {
  const [visibleTab, setVisibleTab] = useState(activeTab)
  const [animClass, setAnimClass] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeTab === visibleTab) return

    // Start fade-out
    setAnimClass('tab-exit')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setVisibleTab(activeTab)
      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        setAnimClass('tab-enter')
        // Clear class after animation completes
        setTimeout(() => setAnimClass(''), durationMs)
      })
    }, durationMs * 0.6) // cross-fade: switch DOM before exit fully completes

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeTab, durationMs])

  return { visibleTab, animClass }
}

/**
 * useKeepAliveTabs — tracks which tabs have been visited so we can keep their DOM mounted.
 * Keeps visited tab DOM nodes active in memory with zero-reflow GPU containment.
 */
export function useKeepAliveTabs(
  activeTab: string,
  persistentTabs: readonly string[]
) {
  const [visited, setVisited] = useState<Set<string>>(new Set([activeTab]))

  useEffect(() => {
    if (persistentTabs.includes(activeTab)) {
      setVisited((prev) => {
        if (prev.has(activeTab)) return prev
        const next = new Set(prev)
        next.add(activeTab)
        return next
      })
    }
  }, [activeTab, persistentTabs])

  const isVisible = useCallback(
    (tab: string) => tab === activeTab,
    [activeTab]
  )

  const shouldMount = useCallback(
    (tab: string) => tab === activeTab || visited.has(tab),
    [activeTab, visited]
  )

  return { isVisible, shouldMount }
}

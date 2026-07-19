import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/useSettingsStore'

/** Sync the persisted theme to the document root so the CSS variables switch. */
export function useApplyTheme(): void {
  const theme = useSettingsStore((state) => state.theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
}

import { Suspense, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { NavBar } from './NavBar'
import { NewHatchModal } from '@renderer/screens/NewHatchModal'
import { Spinner } from '@renderer/components/ui'
import { useUiStore } from '@renderer/store/useUiStore'

function ScreenFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  )
}

/** The persistent frame: nav bar, routed content, global modal, and toasts. */
export function AppShell() {
  const navigate = useNavigate()
  const openNewHatch = useUiStore((s) => s.openNewHatch)

  // Global shortcuts: Cmd/Ctrl+N (New Hatch), Cmd/Ctrl+, (Settings).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (!event.metaKey && !event.ctrlKey) return
      if (event.key === 'n') {
        event.preventDefault()
        openNewHatch()
      } else if (event.key === ',') {
        event.preventDefault()
        navigate('/settings')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, openNewHatch])

  return (
    <div className="flex h-screen flex-col bg-hatch-bg text-hatch-text">
      <NavBar />
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <NewHatchModal />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '!bg-hatch-surface-2 !text-hatch-text !border !border-hatch-border !text-sm',
          duration: 3500
        }}
      />
    </div>
  )
}

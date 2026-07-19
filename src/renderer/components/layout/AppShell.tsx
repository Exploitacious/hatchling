import { Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { NavBar } from './NavBar'
import { NewHatchModal } from '@renderer/screens/NewHatchModal'

/** The persistent frame: nav bar, routed content, global modal, and toasts. */
export function AppShell() {
  return (
    <div className="flex h-screen flex-col bg-hatch-bg text-hatch-text">
      <NavBar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <NewHatchModal />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            '!bg-hatch-surface-2 !text-hatch-text !border !border-hatch-border !text-sm',
          duration: 3500
        }}
      />
    </div>
  )
}

import { APP_NAME } from '@shared/constants'

// Scaffold shell. Phase 2 (Core UI) replaces this with the full routed app:
// nav bar, settings, template library, session library, chat, and results.
export default function App() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-hatch-bg">
      <h1 className="font-mono text-4xl font-semibold text-hatch-accent">{APP_NAME}</h1>
      <p className="text-hatch-muted">Personality forge — scaffold ready.</p>
    </div>
  )
}

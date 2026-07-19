import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@renderer/components/layout/AppShell'

// Screens are code-split so the initial bundle stays small and heavy deps
// (the CodeMirror editor, the Markdown renderer) load only with their route.
const SessionLibraryScreen = lazy(() =>
  import('@renderer/screens/SessionLibraryScreen').then((m) => ({ default: m.SessionLibraryScreen }))
)
const SettingsScreen = lazy(() =>
  import('@renderer/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
)
const TemplateLibraryScreen = lazy(() =>
  import('@renderer/screens/TemplateLibraryScreen').then((m) => ({
    default: m.TemplateLibraryScreen
  }))
)
const TemplateEditorScreen = lazy(() =>
  import('@renderer/screens/TemplateEditorScreen').then((m) => ({ default: m.TemplateEditorScreen }))
)
const ChatScreen = lazy(() =>
  import('@renderer/screens/ChatScreen').then((m) => ({ default: m.ChatScreen }))
)
const ResultsScreen = lazy(() =>
  import('@renderer/screens/ResultsScreen').then((m) => ({ default: m.ResultsScreen }))
)

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SessionLibraryScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="templates" element={<TemplateLibraryScreen />} />
        <Route path="templates/new" element={<TemplateEditorScreen />} />
        <Route path="templates/:id/edit" element={<TemplateEditorScreen />} />
        <Route path="sessions/:id/chat" element={<ChatScreen />} />
        <Route path="sessions/:id/results" element={<ResultsScreen />} />
      </Route>
    </Routes>
  )
}

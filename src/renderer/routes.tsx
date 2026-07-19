import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@renderer/components/layout/AppShell'
import { SessionLibraryScreen } from '@renderer/screens/SessionLibraryScreen'
import { SettingsScreen } from '@renderer/screens/SettingsScreen'
import { TemplateLibraryScreen } from '@renderer/screens/TemplateLibraryScreen'
import { TemplateEditorScreen } from '@renderer/screens/TemplateEditorScreen'
import { ChatScreen } from '@renderer/screens/ChatScreen'
import { ResultsScreen } from '@renderer/screens/ResultsScreen'

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

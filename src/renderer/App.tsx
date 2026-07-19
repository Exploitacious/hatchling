import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useApplyTheme } from '@renderer/theme/useApplyTheme'
import { AppRoutes } from './routes'

export default function App() {
  useApplyTheme()
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}

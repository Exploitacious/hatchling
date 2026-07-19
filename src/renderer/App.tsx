import { useApplyTheme } from '@renderer/theme/useApplyTheme'
import { AppRoutes } from './routes'

export default function App() {
  useApplyTheme()
  return <AppRoutes />
}

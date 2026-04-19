import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { PrivacyProvider } from '@/contexts/PrivacyContext'
import { router } from '@/router'

function App() {
  return (
    <PrivacyProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PrivacyProvider>
  )
}

export default App

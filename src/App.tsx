import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { PrivacyProvider } from '@/contexts/PrivacyContext'
import { router } from '@/router'

function App() {
  return (
    // reducedMotion="user" : framer-motion neutralise les transforms pour
    // qui préfère moins de mouvement — couvre staggers, BlurFade, pages
    <MotionConfig reducedMotion="user">
      <PrivacyProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PrivacyProvider>
    </MotionConfig>
  )
}

export default App

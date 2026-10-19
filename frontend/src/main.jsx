import { createRoot } from 'react-dom/client'
import { Providers } from './shared/Providers.jsx'
import { SessionApp } from './app/SessionApp.jsx'

createRoot(document.getElementById('root')).render(
  <Providers>
    <SessionApp />
  </Providers>,
)

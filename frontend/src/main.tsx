import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProviders } from './providers/AppProviders'
import '../tailwind.css'

const rootEl = document.getElementById('root')

if (!rootEl) {
  throw new Error('Root element #root not found')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
)

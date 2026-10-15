import React from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { applyDesignSystemTokens } from './theme'
import './tokens.css'
import './styles.css'

applyDesignSystemTokens()

const container = document.getElementById('root')

if (!container) {
  throw new Error('Savant renderer: #root container missing from index.html')
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

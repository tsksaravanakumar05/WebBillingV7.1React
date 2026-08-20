import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { isPageExitPrompt, navigateToDashboard } from './utils/pageExit.js'

const nativeConfirm = window.confirm.bind(window)
window.confirm = (message) => {
  if (isPageExitPrompt(message)) {
    navigateToDashboard()
    return false
  }
  return nativeConfirm(message)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />

    
  </React.StrictMode>,
)

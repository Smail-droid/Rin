import React from 'react'
import ReactDOM from 'react-dom/client'
import { configureModalAppElement } from '@rin/ui'
import 'remixicon/fonts/remixicon.css'
import App from './App'
import './index.css'
import './components.css'
import { GlobalErrorBoundary } from './components/error-boundary.tsx'
import { bootstrapApp } from './app/bootstrap'

// 监听 Vite 动态模块按需加载失败事件（部署新版本导致旧 hash chunk 404 时自动刷新以拉取最新静态资源）
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = sessionStorage.getItem('rin_last_chunk_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
    sessionStorage.setItem('rin_last_chunk_reload', String(now));
    window.location.reload();
  } else {
    console.error('Failed to reload dynamic chunk:', event);
  }
});

bootstrapApp()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
configureModalAppElement('#root');

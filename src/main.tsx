import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('Không tìm thấy #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

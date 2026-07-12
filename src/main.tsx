import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyOklchPatch } from './utils/pdfOklchPatch.ts';

// Apply oklch compatibility patch for html2pdf / html2canvas PDF rendering
applyOklchPatch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

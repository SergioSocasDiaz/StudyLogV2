import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { Providers } from './app/providers';
import { router } from './app/router';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container not found');
}

createRoot(container).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);

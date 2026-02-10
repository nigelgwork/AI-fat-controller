import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initApi } from './api';
import './index.css';

initApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — data stays fresh, use refresh button to update
      gcTime: 10 * 60 * 1000,   // 10 minutes — keep unused data in cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,     // Don't refetch when navigating between pages
      retry: 1,                  // Only retry once on failure
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

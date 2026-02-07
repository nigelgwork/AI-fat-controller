import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../../components/Layout';
import { mockElectronAPI } from '../../test/setup';

function createWrapper(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Layout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the application header', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Phat Controller')).toBeInTheDocument();
    });
  });

  it('displays the AI logo', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI')).toBeInTheDocument();
    });
  });

  it('displays version number when available', async () => {
    mockElectronAPI.getVersion.mockResolvedValue('1.0.0');

    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    });
  });

  it('renders navigation links', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
      expect(screen.getByTitle('Phat Controller')).toBeInTheDocument();
      expect(screen.getByTitle('Projects')).toBeInTheDocument();
      expect(screen.getByTitle('Sessions')).toBeInTheDocument();
      expect(screen.getByTitle('Agents')).toBeInTheDocument();
      expect(screen.getByTitle('Tasks')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });
  });

  it('navigation links have correct href attributes', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      const dashboardLink = screen.getByTitle('Dashboard');
      const controllerLink = screen.getByTitle('Phat Controller');
      const projectsLink = screen.getByTitle('Projects');
      const settingsLink = screen.getByTitle('Settings');

      expect(dashboardLink).toHaveAttribute('href', '/');
      expect(controllerLink).toHaveAttribute('href', '/controller');
      expect(projectsLink).toHaveAttribute('href', '/projects');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });

  it('renders the main content area', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      const mainElement = document.querySelector('main');
      expect(mainElement).toBeInTheDocument();
    });
  });

  it('renders the sidebar', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      const asideElement = document.querySelector('aside');
      expect(asideElement).toBeInTheDocument();
    });
  });

  it('renders header with theme toggle', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      const header = document.querySelector('header');
      expect(header).toBeInTheDocument();
    });
  });
});

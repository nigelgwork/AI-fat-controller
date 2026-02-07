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

  it('renders the application header with title', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('AI Phat Controller')).toBeInTheDocument();
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
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getAllByText('Phat Controller').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Sessions')).toBeInTheDocument();
      expect(screen.getByText('Agents')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigation links have correct href attributes', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      const overviewLink = screen.getByTitle('Overview');
      const controllerLink = screen.getByTitle('Phat Controller');
      const projectsLink = screen.getByTitle('Projects');
      const settingsLinks = screen.getAllByTitle('Settings');

      expect(overviewLink).toHaveAttribute('href', '/');
      expect(controllerLink).toHaveAttribute('href', '/controller');
      expect(projectsLink).toHaveAttribute('href', '/projects');
      // Settings appears in both sidebar and top bar
      expect(settingsLinks.length).toBeGreaterThanOrEqual(2);
      settingsLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/settings');
      });
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

  it('renders section headings in sidebar', async () => {
    render(<Layout />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
      expect(screen.getByText('PROJECTS')).toBeInTheDocument();
      expect(screen.getByText('RESOURCES')).toBeInTheDocument();
      expect(screen.getByText('CONTROLLER')).toBeInTheDocument();
    });
  });
});

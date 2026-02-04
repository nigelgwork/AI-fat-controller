import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';
import { mockElectronAPI } from '../../test/setup';

// Create a wrapper component with providers
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dashboard title', async () => {
    render(<Dashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Town Overview')).toBeInTheDocument();
  });

  it('displays project count from system status', async () => {
    mockElectronAPI.getSystemStatus.mockResolvedValue({
      projects: [
        { id: '1', name: 'Project 1', path: '/path/1', hasBeads: false },
        { id: '2', name: 'Project 2', path: '/path/2', hasBeads: true },
      ],
      sessions: [],
      discovered: [],
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('displays task stats', async () => {
    mockElectronAPI.getTasksStats.mockResolvedValue({
      total: 5,
      todo: 2,
      inProgress: 1,
      done: 2,
      byPriority: { low: 1, medium: 2, high: 2 },
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('shows running sessions when present', async () => {
    mockElectronAPI.getSystemStatus.mockResolvedValue({
      projects: [],
      sessions: [
        {
          pid: 1234,
          workingDir: '/test/dir',
          projectName: 'Test Project',
          command: 'claude',
          status: 'running',
          source: 'windows',
        },
      ],
      discovered: [],
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Running Claude Sessions')).toBeInTheDocument();
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  it('shows correct mode status', async () => {
    mockElectronAPI.getModeStatus.mockResolvedValue({
      current: 'windows',
      windows: { available: true, version: '1.0.0' },
      wsl: { available: true, distro: 'Ubuntu' },
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check for Windows section with Active badge
      expect(screen.getByText('Windows')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('navigates to projects page when clicking projects card', () => {
    render(<Dashboard />, { wrapper: createWrapper() });

    const projectsLink = screen.getByRole('link', { name: /projects/i });
    expect(projectsLink).toHaveAttribute('href', '/projects');
  });

  it('navigates to tasks page when clicking tasks card', () => {
    render(<Dashboard />, { wrapper: createWrapper() });

    const tasksLink = screen.getByRole('link', { name: /tasks/i });
    expect(tasksLink).toHaveAttribute('href', '/tasks');
  });

  it('navigates to sessions page when clicking sessions card', () => {
    render(<Dashboard />, { wrapper: createWrapper() });

    const sessionsLink = screen.getByRole('link', { name: /claude sessions/i });
    expect(sessionsLink).toHaveAttribute('href', '/sessions');
  });
});

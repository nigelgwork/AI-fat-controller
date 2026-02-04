import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Controller from './pages/Controller';
import Projects from './pages/Projects';
import NewProject from './pages/NewProject';
import Sessions from './pages/Sessions';
import Agents from './pages/Agents';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import TmuxSessions from './pages/TmuxSessions';
import ClawdbotSettings from './pages/ClawdbotSettings';
import FloatingAssistant from './components/FloatingAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const [hasCompletedSetup, setHasCompletedSetup] = useState<boolean | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    enabled: hasCompletedSetup === true,
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
  });

  useEffect(() => {
    // Check if setup has been completed
    window.electronAPI?.getSetting('hasCompletedSetup').then((completed) => {
      setHasCompletedSetup(completed);
    }).catch(() => {
      // If electronAPI not available (dev mode without electron), skip setup
      setHasCompletedSetup(true);
    });
  }, []);

  // Show loading while checking setup status
  if (hasCompletedSetup === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Show setup wizard if not completed
  if (!hasCompletedSetup) {
    return <Setup onComplete={() => setHasCompletedSetup(true)} />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="controller" element={<Controller />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<NewProject />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="agents" element={<Agents />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tmux" element={<TmuxSessions />} />
          <Route path="clawdbot" element={<ClawdbotSettings />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <FloatingAssistant />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </ErrorBoundary>
  );
}

export default App;

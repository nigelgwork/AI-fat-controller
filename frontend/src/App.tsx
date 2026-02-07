import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Controller from './pages/Controller';
import Projects from './pages/Projects';
import NewProject from './pages/NewProject';
import Sessions from './pages/Sessions';
import Agents from './pages/Agents';
import Tasks from './pages/Tasks';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true,
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
  });

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="controller" element={<Controller />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<NewProject />} />
          <Route path="projects/tasks" element={<Tasks />} />
          <Route path="projects/sessions" element={<Sessions />} />
          <Route path="projects/history" element={<ActivityLog />} />
          <Route path="resources/agents" element={<Agents />} />
          <Route path="resources/mcp" element={<Settings />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </ErrorBoundary>
  );
}

export default App;

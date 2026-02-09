import { Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

import Projects from './pages/Projects';
import NewProject from './pages/NewProject';
import Sessions from './pages/Sessions';
import Agents from './pages/Agents';
import Tasks from './pages/Tasks';
import History from './pages/History';
import Settings from './pages/Settings';
import Terminals from './pages/Terminals';
import Skills from './pages/Skills';
import MCP from './pages/MCP';
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
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<NewProject />} />
          <Route path="projects/tasks" element={<Tasks />} />
          <Route path="projects/sessions" element={<Sessions />} />
          <Route path="projects/history" element={<History />} />
          <Route path="resources/agents" element={<Agents />} />
          <Route path="resources/mcp" element={<MCP />} />
          <Route path="resources/skills" element={<Skills />} />
          <Route path="terminals" element={<Terminals />} />
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

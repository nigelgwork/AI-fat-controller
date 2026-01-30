import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminal from './pages/Terminal';
import Projects from './pages/Projects';
import Sessions from './pages/Sessions';
import Agents from './pages/Agents';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Setup from './pages/Setup';

function App() {
  const [hasCompletedSetup, setHasCompletedSetup] = useState<boolean | null>(null);

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
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="terminal" element={<Terminal />} />
        <Route path="projects" element={<Projects />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="agents" element={<Agents />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;

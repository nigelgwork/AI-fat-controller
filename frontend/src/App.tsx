import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminal from './pages/Terminal';
import Agents from './pages/Agents';
import Beads from './pages/Beads';
import Convoys from './pages/Convoys';
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
        <Route path="agents" element={<Agents />} />
        <Route path="beads" element={<Beads />} />
        <Route path="convoys" element={<Convoys />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;

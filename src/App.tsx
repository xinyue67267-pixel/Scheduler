import { useState } from 'react';
import Sidebar from '@/components/Layout/Sidebar';
import Timeline from '@/pages/Timeline';
import Paradigm from '@/pages/Paradigm';
import Requirements from '@/pages/Requirements';
import Settings from '@/pages/Settings';

export type Page = 'timeline' | 'paradigm' | 'requirements' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('timeline');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'timeline':
        return <Timeline />;
      case 'paradigm':
        return <Paradigm />;
      case 'requirements':
        return <Requirements />;
      case 'settings':
        return <Settings />;
      default:
        return <Timeline />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        expanded={sidebarExpanded}
        onToggleExpand={() => setSidebarExpanded(!sidebarExpanded)}
      />
      <main className="flex-1 overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;

import { useState } from 'react';
import Sidebar from '@/components/Layout/Sidebar';
import AuthModal from '@/components/Auth/AuthModal';
import Timeline from '@/pages/Timeline';
import Paradigm from '@/pages/Paradigm';
import Requirements from '@/pages/Requirements';
import Settings from '@/pages/Settings';
import { AuthProvider } from '@/context/AuthContext';

export type Page = 'timeline' | 'paradigm' | 'requirements' | 'settings';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('timeline');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          expanded={sidebarExpanded}
          onToggleExpand={() => setSidebarExpanded(!sidebarExpanded)}
          onLoginClick={() => setShowAuthModal(true)}
        />
        <main className="flex-1 overflow-hidden">
          {renderPage()}
        </main>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="login"
      />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

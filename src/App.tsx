import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import AuthPage from './pages/AuthPage';
import BenchMap from './pages/BenchMap';
import BenchPage from './pages/BenchPage';
import AchievementNotification from './components/AchievementNotification';
import LegalPage from './components/LegalPage';
import AboutPage from './pages/AboutPage';
import PWAInstallPrompt from './components/PWAInstallPrompt';

interface AppContentProps {
  onReady: () => void;
}

function AppContent({ onReady }: AppContentProps) {
  const { session, loading } = useAuth();
  const [legalTab, setLegalTab] = useState<'tos' | 'privacy' | null>(null);
  const location = useLocation();

  const isBenchDetailRoute = location.pathname.startsWith('/bench/');
  const isLoginRoute = location.pathname === '/login';

  useEffect(() => {
    if (!loading) onReady();
  }, [loading]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<'tos' | 'privacy'>).detail;
      setLegalTab(detail);
    };
    window.addEventListener('open-legal', handler);
    return () => window.removeEventListener('open-legal', handler);
  }, []);

  if (isBenchDetailRoute) {
    return (
      <>
        <Routes>
          <Route path="/bench/:id" element={<BenchPage />} />
        </Routes>
        {session?.user && <AchievementNotification userId={session.user.id} />}
      </>
    );
  }

  if (loading) return null;

  if (legalTab) {
    return <LegalPage initialTab={legalTab} onClose={() => setLegalTab(null)} />;
  }

  if (isLoginRoute) {
    return <AuthPage />;
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<BenchMap />} />
      </Routes>
      {session?.user && <AchievementNotification userId={session.user.id} />}
      <PWAInstallPrompt />
    </>
  );
}

interface AppProps {
  onReady?: () => void;
}

function App({ onReady }: AppProps) {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent onReady={onReady ?? (() => {})} />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import ProgressPage from './pages/ProgressPage';
import HistoryPage from './pages/HistoryPage';
import HabitsPage from './pages/HabitsPage';
import InsightsPage from './pages/InsightsPage';
import ChatbotLauncher from './components/chatbot/ChatbotLauncher';
import ProfileSetup from './components/profile/ProfileSetup';
import './index.css';

type Page = 'dashboard' | 'analysis' | 'progress' | 'history' | 'habits' | 'insights';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'analysis',  label: 'Analyse',   icon: '🔬' },
  { id: 'progress',  label: 'Progress',  icon: '📈' },
  { id: 'history',   label: 'History',   icon: '🗂' },
  { id: 'habits',    label: 'Habits',    icon: '📋' },
  { id: 'insights',  label: 'Insights',  icon: '💡' },
];

function AppShell() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [page, setPage]           = useState<Page>('dashboard');
  const [menuOpen, setMenuOpen]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">🌿</div>
        <p>Loading AyurSkin AI...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthPage />;

  // Show profile setup modal if profile is incomplete
  if (user && !(user as any).profileComplete && !showProfile) {
    // We'll show it as a dismissible modal
  }

  const go = (p: Page) => { setPage(p); setMenuOpen(false); };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage setPage={(p: string) => go(p as Page)} />;
      case 'analysis':  return <AnalysisPage />;
      case 'progress':  return <ProgressPage />;
      case 'history':   return <HistoryPage />;
      case 'habits':    return <HabitsPage />;
      case 'insights':  return <InsightsPage />;
      default:          return <DashboardPage setPage={(p: string) => go(p as Page)} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-logo">🌿</span>
          <div>
            <div className="brand-name">AyurSkin AI</div>
            <div className="brand-tagline">v3 · Intelligent Skincare</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => go(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="profile-btn" onClick={() => setShowProfile(true)}>
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </button>
          <button className="logout-btn" onClick={logout} title="Logout">↩</button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="mobile-header">
        <button className="hamburger" onClick={() => setMenuOpen(m => !m)}>
          {menuOpen ? '✕' : '☰'}
        </button>
        <span className="mobile-brand">🌿 AyurSkin AI</span>
        <button className="mobile-logout" onClick={logout}>↩</button>
      </header>

      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}

      <main className="main-content">{renderPage()}</main>

      {/* Floating chatbot */}
      <ChatbotLauncher onRequestAnalysis={() => go('analysis')} />

      {/* Profile setup modal */}
      {showProfile && (
        <ProfileSetup onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

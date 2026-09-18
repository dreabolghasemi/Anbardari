import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginView } from './components/LoginView.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, NavView } from './components/Sidebar.js';
import { DashboardView } from './components/DashboardView.js';
import { ItemsView } from './components/ItemsView.js';
import { InventoryView } from './components/InventoryView.js';
import { StockInView } from './components/StockInView.js';
import { StockOutView } from './components/StockOutView.js';
import { StockTransferView } from './components/StockTransferView.js';
import { WarehousesView } from './components/WarehousesView.js';
import { ReportsView } from './components/ReportsView.js';
import { UsersView } from './components/UsersView.js';
import { AuditBackupView } from './components/AuditBackupView.js';
import { ServerInfoView } from './components/ServerInfoView.js';
import { SettingsView } from './components/SettingsView.js';
import { ItemDetailModal } from './components/ItemDetailModal.js';
import { WelcomeSlide } from './components/WelcomeSlide.js';
import { ZobAhanLogo } from './components/ZobAhanLogo.js';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, isLoading, isAdmin, welcomeUser, clearWelcomeUser } = useAuth();
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/80 p-2 flex items-center justify-center animate-bounce shadow-xl shadow-black/50">
          <ZobAhanLogo className="w-12 h-12" />
        </div>
        <div className="text-center">
          <h2 className="text-sm font-bold text-white">واحد اعلام حریق ذوب‌آهن اصفهان</h2>
          <p className="text-xs text-slate-400 mt-1">در حال اتصال به سرور و بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (welcomeUser) {
    return <WelcomeSlide user={welcomeUser} onComplete={clearWelcomeUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-slate-950" dir="rtl">
      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onNavigateSettings={() => setCurrentView('settings')}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Responsive Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(view) => setCurrentView(view)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {currentView === 'dashboard' && (
              <DashboardView
                onNavigate={(v) => setCurrentView(v)}
                onSelectItem={(id) => setSelectedItemId(id)}
              />
            )}

            {currentView === 'items' && (
              <ItemsView onSelectItem={(id) => setSelectedItemId(id)} />
            )}

            {currentView === 'inventory' && <InventoryView />}

            {currentView === 'stock-in' && <StockInView />}

            {currentView === 'stock-out' && <StockOutView />}

            {currentView === 'transfer' && <StockTransferView />}

            {currentView === 'warehouses' && <WarehousesView />}

            {currentView === 'reports' && <ReportsView />}

            {currentView === 'users' && isAdmin && <UsersView />}

            {(currentView === 'audit' || currentView === 'backup') && isAdmin && (
              <AuditBackupView />
            )}

            {currentView === 'server-info' && isAdmin && <ServerInfoView />}

            {currentView === 'settings' && <SettingsView onNavigateServerInfo={() => setCurrentView('server-info')} />}
          </div>
        </main>
      </div>

      {/* Item Detail / Catalog PDF Modal */}
      {selectedItemId && (
        <ItemDetailModal
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

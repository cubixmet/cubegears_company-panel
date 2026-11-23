import { useLayoutEffect, useRef } from "react";
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineInventory } from '../../pwa/InventoryOfflineProvider';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { routeConfig } from '../../routes/routeConfig';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Footer } from './Footer';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import '../../styles/layout.css';

export const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const { offline, snapshot } = useOfflineInventory();
  const { logout } = useAuth();
  const { can } = useFeatureAccess();
  const scrollAreaRef = useRef(null);

  // This layout uses its own scrolling <main>, not the browser window.
  // Every Account tab and nested storage page starts at its top, including
  // client-side navigation and browser back/forward history.
  useLayoutEffect(() => {
    if (location.pathname === '/account' || location.pathname.startsWith('/account/')) {
      if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0;
    }
  }, [location.pathname]);
  const isInvoiceWorkspace =
    location.pathname.startsWith('/invoices/') ||
    location.pathname.startsWith('/quotations/');
  const isDashboard = location.pathname === '/dashboard';
  const isJobsWorkspace = /^\/jobs(?:\/|$)/.test(location.pathname);
  const useDashboardSpacing = isDashboard || isJobsWorkspace;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main-column">
        {offline ? (
          <nav className="cg-pwa-controls cg-pwa-offline-nav" aria-label="Offline workspace"
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            <strong>Offline · previously saved data</strong>
            <span>Other changes require internet. Inventory drafts can sync after reconnection.</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {routeConfig.filter(route => can(route.permission) || route.accessAny?.some(can)).map(route =>
                <Link key={route.path} to={route.path}>{route.label}</Link>)}
              {snapshot && <Link to="/stock">Offline Inventory</Link>}
              <button type="button" onClick={logout}>Sign out</button>
            </div>
          </nav>
        ) : <Header />}

        <main className="app-scroll-area" ref={scrollAreaRef}>
          <div className={`app-content ${useDashboardSpacing ? 'is-dashboard-content' : ''}`}>
            {!useDashboardSpacing && <AppBreadcrumbs />}
            {children}
          </div>

          {!offline && !isInvoiceWorkspace && <Footer />}
        </main>
      </div>

      {/* Keep mobile navigation available on every protected workspace route,
          including invoice and estimate pages; document previews still omit
          the nonessential footer. */}
      {!offline && <MobileBottomNav />}
    </div>
  );
};

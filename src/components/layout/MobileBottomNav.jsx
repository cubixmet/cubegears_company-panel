import { useState } from "react";
import { NavLink, useLocation } from 'react-router-dom';
import { routeConfig, mobilePrimaryRoutes } from '../../routes/routeConfig';
import { MoreHorizontal } from 'lucide-react';
import { MobileSlideSidebar } from './MobileSlideSidebar';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/mobile-bottom-nav.css';

// Short labels fit four quick actions plus More on a 320–390px display.
// Full module names remain available to screen readers and in the More drawer.
const mobileLabels = {
  credits: 'Account',
  dashboard: 'Home',
  jobs: 'Jobs',
  stock: 'Inventory',
};

export const MobileBottomNav = () => {
  const location = useLocation();
  const featureAccess = useFeatureAccess();
  // Pin Account for company owners, even before their first paid label.
  // Everything else still comes from Django's role/entitlement intersection.
  const ownerAccount = routeConfig.find((route) => route.id === 'credits');
  const primaryCandidates = [
    ...(featureAccess.isCompanyOwner && ownerAccount && featureAccess.can(ownerAccount.permission) ? [ownerAccount] : []),
    ...mobilePrimaryRoutes.filter((route) => featureAccess.can(route.permission)),
  ];
  // Four quick links + More fit comfortably on narrow mobile screens.
  const visiblePrimaryRoutes = primaryCandidates.slice(0, 4);
  const primaryIds = new Set(visiblePrimaryRoutes.map((route) => route.id));
  const visibleMoreRoutes = routeConfig.filter((route) =>
    !primaryIds.has(route.id)
    && (route.accessAny ? route.accessAny.some(featureAccess.can) : featureAccess.can(route.permission))
    && (route.id !== 'credits' || featureAccess.isCompanyOwner)
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMoreActive = visibleMoreRoutes.some((route) =>
    location.pathname === route.path || location.pathname.startsWith(`${route.path}/`)
  ) || location.pathname === '/profile' || location.pathname === '/account/company';

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {visiblePrimaryRoutes.map((route) => {
          const IconComp = route.icon;
          const isActive = location.pathname.startsWith(route.path);

          return (
            <NavLink
              key={route.id}
              to={route.path}
              aria-label={route.label}
              className={`mobile-bottom-item ${isActive ? 'is-active' : ''}`}
            >
              <span className="mobile-bottom-icon">
                <IconComp size={19} strokeWidth={isActive ? 2.2 : 1.8} />
              </span>
              <span className="mobile-bottom-label">{mobileLabels[route.id] || route.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open all authorized pages"
          aria-expanded={isSidebarOpen}
          className={`mobile-bottom-item mobile-more-button ${isMoreActive ? 'is-active' : ''}`}
        >
          <span className="mobile-bottom-icon">
            <MoreHorizontal size={19} strokeWidth={2} />
          </span>
          <span className="mobile-bottom-label">More</span>
        </button>
      </nav>

      <MobileSlideSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  );
};

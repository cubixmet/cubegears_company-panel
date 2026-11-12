import { WorkshopIdentity } from '../branding/WorkshopIdentity';
import { useEffect, useRef } from "react";
import { NavLink, useLocation } from 'react-router-dom';
import { routeConfig, ROUTE_SECTIONS } from '../../routes/routeConfig';
import { Laptop, LogOut, Moon, Sun, X, UserRound, Store } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { getUserRoleLabel } from '../../utils/authDisplay';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/mobile-slide-sidebar.css';

export const MobileSlideSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const featureAccess = useFeatureAccess();
  const { themeMode, setThemeMode } = useTheme();
  const roleLabel = getUserRoleLabel(user);
  const avatarSrc = typeof user?.avatar === 'string' ? user.avatar.trim() : '';
  const avatarInitials = String(user?.name || user?.email || 'CG')
    .trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CG';
  const activeItemRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeItemRef.current) return undefined;
    const timer = window.setTimeout(() => {
      activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, location.pathname, location.search]);

  const sections = Object.values(ROUTE_SECTIONS);
  const visibleRoutes = routeConfig.filter(route => featureAccess.can(route.permission) ||
    (Array.isArray(route.accessAny) && route.accessAny.some(permission => featureAccess.can(permission))))
    .filter(route => route.id !== 'credits' || featureAccess.isCompanyOwner);
  const isRouteActive = (route) => {
    if (route.path === '/dashboard') return location.pathname === '/dashboard';
    // Customer Website has its own menu item, separate from Settings.
    if (route.path === '/settings' && location.pathname.startsWith('/settings/customer-website')) return false;
    return location.pathname === route.path || location.pathname.startsWith(`${route.path}/`);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close menu backdrop"
        onClick={onClose}
        className={`mobile-drawer-backdrop ${isOpen ? 'is-open' : ''}`}
      />

      <aside
        aria-hidden={!isOpen}
        className={`mobile-drawer ${isOpen ? 'is-open' : ''}`}
      >
        <header className="mobile-drawer-head">
          <div className="mobile-drawer-brand mobile-drawer-dual-brand">
            <div className="mobile-drawer-company-line">
              <WorkshopIdentity mode="drawer" shortName />
            </div>
          </div>

          <button type="button" className="mobile-drawer-close" onClick={onClose} aria-label="Close menu">
            <X size={17}/>
          </button>
        </header>

        <div className="mobile-drawer-title-row">
          <div>
            <span>MENU</span>
            <strong>Workspace</strong>
          </div>
          <small>{visibleRoutes.length} available pages</small>
        </div>

        <nav className="mobile-drawer-nav" aria-label="Mobile navigation">
          <section className="mobile-drawer-section">
            <div className="mobile-drawer-section-title">Your account</div>
            <div className="mobile-drawer-items">
              <NavLink to="/profile" onClick={onClose} className="mobile-drawer-item">
                <span className="mobile-drawer-item-icon"><UserRound size={17}/></span>
                <span className="mobile-drawer-item-label">Profile</span>
              </NavLink>
              {featureAccess.isCompanyOwner && <NavLink to="/account/company" onClick={onClose} className="mobile-drawer-item">
                <span className="mobile-drawer-item-icon"><Store size={17}/></span>
                <span className="mobile-drawer-item-label">Shop Details</span>
              </NavLink>}
            </div>
          </section>
          {sections.map((section) => {
            const items = visibleRoutes.filter((route) => route.section === section);
            if (!items.length) return null;

            return (
              <section key={section} className="mobile-drawer-section">
                <div className="mobile-drawer-section-title">{section}</div>

                <div className="mobile-drawer-items">
                  {items.map((route) => {
                    const IconComp = route.icon;
                    const isActive = isRouteActive(route);
                    // Suppliers uses one mobile drawer link; section tabs live on the page.
                    return (
                      <NavLink
                        key={route.id}
                        to={route.path}
                        end={route.path === '/settings'}
                        onClick={onClose}
                        ref={isActive ? activeItemRef : null}
                        className={`mobile-drawer-item ${isActive ? 'is-active' : ''}`}
                      >
                        <span className="mobile-drawer-item-icon">
                          <IconComp size={17} strokeWidth={isActive ? 2.2 : 1.8}/>
                        </span>
                        <span className="mobile-drawer-item-label">{route.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <footer className="mobile-drawer-footer">
          <div className="mobile-drawer-theme">
            <button type="button" className={themeMode === 'light' ? 'is-active' : ''} onClick={() => setThemeMode('light')}>
              <Sun size={14}/><span>Light</span>
            </button>
            <button type="button" className={themeMode === 'dark' ? 'is-active' : ''} onClick={() => setThemeMode('dark')}>
              <Moon size={14}/><span>Dark</span>
            </button>
            <button type="button" className={themeMode === 'system' ? 'is-active' : ''} onClick={() => setThemeMode('system')}>
              <Laptop size={14}/><span>System</span>
            </button>
          </div>

          <div className="mobile-drawer-user">
            {avatarSrc
              ? <img src={avatarSrc} alt="" />
              : <span className="mobile-drawer-user-avatar-fallback" aria-hidden="true">{avatarInitials}</span>}
            <span>
              <strong>{user?.name || 'User'}</strong>
              <small>{roleLabel}</small>
            </span>
            <button type="button" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={16}/>
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
};

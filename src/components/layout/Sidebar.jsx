import { WorkshopIdentity } from '../branding/WorkshopIdentity';
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from 'react-router-dom';
import { routeConfig, ROUTE_SECTIONS } from '../../routes/routeConfig';
import { ChevronLeft, ChevronRight, Laptop, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { resourceConfigs } from '../../pages/operations/resourceConfigs';
import { unreadNotificationCount } from '../../utils/notificationInbox';
import { getUserRoleLabel } from '../../utils/authDisplay';
import { useFeatureAccess } from '../../context/FeatureAccessContext';

export const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const featureAccess = useFeatureAccess();
  const canViewNotifications = featureAccess.can('notifications.view');
  const { themeMode, setThemeMode } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const roleLabel = getUserRoleLabel(user);
  // An empty image src reloads the current page in some browsers.
  const avatarSrc = typeof user?.avatar === 'string' ? user.avatar.trim() : '';
  const avatarInitials = String(user?.name || user?.email || 'CG')
    .trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CG';
  const activeItemRef = useRef(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [location.pathname]);

  useEffect(() => {
    // Never poll an API that the logged-in staff role cannot read.
    if (!canViewNotifications) {
      setNotificationCount(0);
      return undefined;
    }
    let mounted = true;
    const loadNotificationCount = async () => {
      try {
        const rows = await resourceConfigs.notifications.service.list();
        if (mounted) setNotificationCount(unreadNotificationCount(rows));
      } catch {
        if (mounted) setNotificationCount(0);
      }
    };

    loadNotificationCount();
    const onStorage = (event) => {
      if (!event.key || event.key === 'cubixgear:notifications') loadNotificationCount();
    };
    const onVisible = () => {
      if (!document.hidden) void loadNotificationCount();
    };
    const timer = window.setInterval(onVisible, 60000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('cubixgear:notifications-changed', loadNotificationCount);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('cubixgear:notifications-changed', loadNotificationCount);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [location.pathname, canViewNotifications]);

  const sections = Object.values(ROUTE_SECTIONS);
  const isRouteActive = (route) => {
    if (route.path === '/dashboard') return location.pathname === '/dashboard';
    // Customer Website is a standalone navigation entry, not an active Settings tab.
    if (route.path === '/settings' && location.pathname.startsWith('/settings/customer-website')) return false;
    return location.pathname === route.path || location.pathname.startsWith(`${route.path}/`);
  };

  return (
    <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-brand-row">
        <div className="sidebar-brand sidebar-workshop-only">
          <WorkshopIdentity mode="sidebar" shortName collapsed={collapsed} />
        </div>

        {!collapsed ? (
          <button type="button" className="sidebar-collapse-button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar">
            <ChevronLeft size={14} />
          </button>
        ) : (
          <button type="button" className="sidebar-expand-button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar">
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-sections">
          {sections.map((section) => {
            const items = routeConfig.filter(
              (route) => route.section === section && (route.accessAny ? route.accessAny.some(featureAccess.can) : featureAccess.can(route.permission))
            );
            if (!items.length) return null;

            return (
              <section key={section} className="sidebar-section">
                {!collapsed && <div className="sidebar-section-title">{section}</div>}

                <div className="sidebar-items">
                  {items.map((route) => {
                    const Icon = route.icon;
                    const active = isRouteActive(route);

                    // All sections, including Suppliers, navigate from one parent link.
                    return (
                      <NavLink
                        key={route.id}
                        to={route.path}
                        end={route.path === '/settings'}
                        ref={active ? activeItemRef : null}
                        title={collapsed ? route.label : undefined}
                        className={`sidebar-nav-item ${active ? 'is-active' : ''} ${collapsed ? 'is-icon-only' : ''}`}
                      >
                        <span className="sidebar-nav-icon">
                          <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                          {route.id === 'notifications' && notificationCount > 0 && collapsed && (
                            <span className="sidebar-notification-count is-collapsed">{notificationCount > 99 ? '99+' : notificationCount}</span>
                          )}
                        </span>
                        {!collapsed && <span className="sidebar-nav-label">{route.label}</span>}
                        {route.id === 'notifications' && notificationCount > 0 && !collapsed && (
                          <span className="sidebar-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-theme-switch">
            <button type="button" className={themeMode === 'light' ? 'is-active' : ''} onClick={() => setThemeMode('light')} title="Light"><Sun size={13} /></button>
            <button type="button" className={themeMode === 'dark' ? 'is-active' : ''} onClick={() => setThemeMode('dark')} title="Dark"><Moon size={13} /></button>
            <button type="button" className={themeMode === 'system' ? 'is-active' : ''} onClick={() => setThemeMode('system')} title="System"><Laptop size={13} /></button>
          </div>
        )}

        <div className={`sidebar-user ${collapsed ? 'is-collapsed-user' : ''}`}>
          {avatarSrc
            ? <img src={avatarSrc} alt="" />
            : <span className="sidebar-user-avatar-fallback" aria-hidden="true">{avatarInitials}</span>}
          {!collapsed && (
            <>
              <span className="sidebar-user-copy">
                <strong>{user?.name || 'User'}</strong>
                <small>{roleLabel}</small>
              </span>
              <button type="button" className="sidebar-logout" onClick={logout} aria-label="Log out"><LogOut size={14} /></button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

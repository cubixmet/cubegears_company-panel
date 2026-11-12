import { CubixgearLogo } from '../branding/CubixgearLogo';
import { useContext, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CalendarDays, ChevronDown, LogOut, Settings, Store, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlobalSearch } from '../common/GlobalSearch';
import { resourceConfigs } from '../../pages/operations/resourceConfigs';
import { unreadNotificationCount } from '../../utils/notificationInbox';
import { getStaffLandingPath } from '../../utils/staffLanding';
import { getUserRoleLabel } from '../../utils/authDisplay';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { staffService } from '../../services/staff.service';
import { settingsService } from '../../services/settings.service';
import { CompanyContext } from '../../context/CompanyContext';
import { CreditBalanceChip } from './CreditBalanceChip';
import '../../styles/credit-wallet.css';

const resolveStaticPageTitle = (pathname) => {
  if (pathname === '/dashboard') return 'Dashboard';
  if (/^\/staff-management\/staff\/[^/]+$/.test(pathname)) return 'Staff Profile';

  const last = pathname.split('/').filter(Boolean).slice(-1)[0] || 'Workspace';
  const decoded = decodeURIComponent(last);

  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded)) return 'Details';

  return decoded.replace(/-/g, ' ');
};

export const Header = () => {
  const { user, logout } = useAuth();
  const { company } = useContext(CompanyContext);
  const companyId = company?.id || null;
  const companyName = typeof company?.name === 'string' && company.name.trim()
    ? company.name.trim() : 'Workshop';
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyLogoVersion, setCompanyLogoVersion] = useState(0);
  const { can, isCompanyOwner, permissions } = useFeatureAccess();
  const homePath = getStaffLandingPath({ isCompanyOwner, effectivePermissions: permissions });
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [pageTitle, setPageTitle] = useState(() =>
    resolveStaticPageTitle(location.pathname),
  );
  const roleLabel = getUserRoleLabel(user);
  const avatarSrc = typeof user?.avatar === 'string' ? user.avatar.trim() : '';
  const initials = String(user?.name || user?.email || 'CG')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CG';
  const canViewNotifications = can('notifications.view');
  const canViewSettings = can('settings.view');
  const desktopProfileRef = useRef(null);

  // The private logo endpoint is tenant-scoped and requires an auth token.
  // Always revoke prior object URLs when an account changes or this view unmounts.
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setCompanyLogo('');
    if (companyId) {
      settingsService.getCompanyLogo()
        .then((blob) => {
          if (!active || !blob || !blob.type?.startsWith('image/')) return;
          objectUrl = URL.createObjectURL(blob);
          setCompanyLogo(objectUrl);
        })
        .catch(() => { /* Use the workshop icon if there is no uploaded logo. */ });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [companyId, companyLogoVersion]);

  useEffect(() => {
    const refresh = () => setCompanyLogoVersion((version) => version + 1);
    window.addEventListener('cubixgear:company-logo-updated', refresh);
    return () => window.removeEventListener('cubixgear:company-logo-updated', refresh);
  }, []);
  const mobileProfileRef = useRef(null);

  useEffect(() => {
    // Notifications can be a paid/disabled module for strict tenants.
    // Never request its API while Django says notifications.view is denied.
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
    // Customer decisions are created on the server, so another browser/tab
    // would not fire a local storage event. Refresh while this workspace is
    // visible and immediately when it becomes active again.
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

  useEffect(() => {
    let active = true;
    const fallback = resolveStaticPageTitle(location.pathname);
    setPageTitle(fallback);

    const staffProfileMatch = location.pathname.match(
      /^\/staff-management\/staff\/([^/]+)$/,
    );

    if (staffProfileMatch) {
      staffService
        .getStaffById(decodeURIComponent(staffProfileMatch[1]))
        .then((profile) => {
          if (active) setPageTitle(profile?.name || 'Staff Profile');
        })
        .catch(() => {
          if (active) setPageTitle('Staff Profile');
        });
    }

    return () => {
      active = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const close = (event) => {
      const inDesktopProfile = desktopProfileRef.current?.contains(event.target);
      const inMobileProfile = mobileProfileRef.current?.contains(event.target);
      if (!inDesktopProfile && !inMobileProfile) setProfileDropdownOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (path) => {
    setProfileDropdownOpen(false);
    navigate(path);
  };

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const renderProfileMenu = () => (
    <div className="header-profile-menu">
      <button type="button" onClick={() => go('/profile')}><User size={15}/> Profile & Account</button>
      {canViewSettings && (
        <button type="button" onClick={() => go('/settings')}><Settings size={15}/> Settings</button>
      )}
      <div className="header-menu-separator" />
      <button type="button" className="is-danger" onClick={() => { setProfileDropdownOpen(false); logout(); }}><LogOut size={15}/> Logout</button>
    </div>
  );

  return (
    <header className="app-header">
      <div className="desktop-header-row">
        <div className="header-page-title">{pageTitle}</div>

        <div className="header-actions">
          <div className="header-search-wrap">
            <GlobalSearch />
          </div>

          <CreditBalanceChip />

          <div className="header-date">
            <CalendarDays size={13}/>
            <span>{dateLabel}</span>
          </div>

          {canViewNotifications && (
            <button type="button" className={`header-icon-button has-notification-count ${location.pathname === '/notifications' ? 'is-notifications-active' : ''}`} onClick={() => navigate('/notifications')} aria-label={`Notifications, ${notificationCount} unread`} aria-current={location.pathname === '/notifications' ? 'page' : undefined}>
              {notificationCount ? <BellRing size={19}/> : <Bell size={19}/>}
              {notificationCount > 0 && <span className="header-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span>}
            </button>
          )}

          {canViewSettings && (
            <button type="button" className="header-icon-button" onClick={() => navigate('/settings')} aria-label="Settings">
              <Settings size={15}/>
            </button>
          )}

          <div className="header-profile-wrap" ref={desktopProfileRef}>
            <button type="button" className="header-profile-button" onClick={() => setProfileDropdownOpen((value) => !value)} aria-expanded={profileDropdownOpen}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="" />
              ) : (
                <span className="header-avatar-fallback" aria-hidden="true">{initials}</span>
              )}
              <span className="header-profile-copy">
                <strong>{user?.name || 'User'}</strong>
                <small>{roleLabel}</small>
              </span>
              <ChevronDown size={12}/>
            </button>
            {profileDropdownOpen && renderProfileMenu()}
          </div>
        </div>
      </div>

      <div className="mobile-header">
        <div className="mobile-header-row">
          <button type="button" className="mobile-brand mobile-workshop-brand" onClick={() => navigate(homePath)} aria-label={`Go to ${companyName} workspace`}>
            <span className="mobile-brand-icon mobile-company-logo" aria-hidden="true">
              {companyLogo
                ? <img src={companyLogo} alt="" />
                : <Store size={19} strokeWidth={1.9} />}
            </span>
            <span className="mobile-brand-copy">
              <strong title={companyName}>{companyName}</strong>
              <small className="mobile-powered-brand">
                <span className="mobile-powered-logo" aria-hidden="true"><CubixgearLogo /></span>
                <span>cubixgear</span>
              </small>
            </span>
          </button>

          <div className="mobile-header-actions">
            <CreditBalanceChip compact />
            {canViewNotifications && (
              <button type="button" className={`mobile-notification-button ${location.pathname === '/notifications' ? 'is-notifications-active' : ''}`} onClick={() => navigate('/notifications')} aria-label={`Notifications, ${notificationCount} unread`} aria-current={location.pathname === '/notifications' ? 'page' : undefined}>
                {notificationCount ? <BellRing size={19}/> : <Bell size={19}/>}
                {notificationCount > 0 && <span className="header-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span>}
              </button>
            )}
            <div className="header-profile-wrap" ref={mobileProfileRef}>
              <button type="button" className="mobile-profile-button" onClick={() => setProfileDropdownOpen((value) => !value)} aria-expanded={profileDropdownOpen}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" />
                ) : (
                  <span className="mobile-avatar-fallback" aria-hidden="true">{initials}</span>
                )}
              </button>
              {profileDropdownOpen && renderProfileMenu()}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};

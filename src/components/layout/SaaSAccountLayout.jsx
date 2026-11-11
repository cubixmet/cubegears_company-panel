import { CubixgearLogo } from '../branding/CubixgearLogo';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShieldCheck, Store, User, Wallet, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/saas-account-layout.css';
import '../../styles/saas-owner-dashboard-refresh.css';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { routeConfig, ROUTE_SECTIONS } from '../../routes/routeConfig';

// Navigation is presentation only: Django permissions, activated paid labels,
// and ProtectedRoute remain the authority for every workshop route.
const ACCOUNT_LINKS = [
  { path: '/account', label: 'SaaS Account', icon: Wallet },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/account/company', label: 'Shop Details', icon: Store },
];

export function SaaSAccountLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const access = useFeatureAccess();
  const navigate = useNavigate();
  const scrollArea = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const accountLinks = access.billingStatus?.blocked ? ACCOUNT_LINKS.filter(link => link.path === '/account') : ACCOUNT_LINKS;
  const workshopLinks = routeConfig.filter(
    route => route.id !== 'credits' && access.can(route.permission)
  );
  const workshopSections = Object.values(ROUTE_SECTIONS)
    .map(section => ({
      section,
      links: workshopLinks.filter(route => route.section === section),
    }))
    .filter(group => group.links.length > 0);

  useLayoutEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };
  const sidebarLink = ({ path, label, icon: Icon }) => (
    <NavLink
      key={path}
      to={path}
      end={path === '/account'}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) => isActive ? 'is-active' : ''}
    >
      <span className="saas-owner-link-icon"><Icon size={18} aria-hidden="true"/></span>
      <span>{label}</span>
    </NavLink>
  );

  return <div className="saas-account-shell saas-payment-recovery-shell">
    <header className="saas-account-topbar">
      <div className="saas-account-topbar-start">
        <button
          type="button"
          className="saas-owner-menu-toggle"
          onClick={() => setMenuOpen(open => !open)}
          aria-label={menuOpen ? 'Close account navigation' : 'Open account navigation'}
          aria-expanded={menuOpen}
          aria-controls="saas-owner-navigation"
        >{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
        <NavLink to="/account" className="saas-account-brand">
          <span className="saas-account-logo" aria-hidden="true"><CubixgearLogo /></span>
          <span><strong>cubixgear</strong><small>Account workspace</small></span>
        </NavLink>
      </div>
      <div className="saas-account-identity">
        <div><strong>{user?.company?.name || user?.companyName || 'Company Account'}</strong><small>{user?.name || 'Account owner'}</small></div>
        <button type="button" onClick={signOut}><LogOut size={16}/> <span>Sign out</span></button>
      </div>
    </header>
    <div className="saas-account-body">
      <nav
        id="saas-owner-navigation"
        className={`saas-owner-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label="Account and authorized workshop navigation"
      >
        <div className="saas-owner-sidebar-scroll">
          <div className="saas-owner-sidebar-group">
            <p className="saas-owner-sidebar-heading">MY ACCOUNT</p>
            {accountLinks.map(sidebarLink)}
          </div>
          {workshopSections.map(({ section, links }) => <div key={section} className="saas-owner-sidebar-group">
            <p className="saas-owner-sidebar-heading">{section}</p>
            {links.map(sidebarLink)}
          </div>)}
          {!workshopLinks.length && <div className="saas-owner-sidebar-empty">
            <ShieldCheck size={18} aria-hidden="true"/>
            <p>Workshop modules appear here when an active feature label and your role allow access.</p>
            {access.isCompanyOwner && access.can('billing.view') &&
              <NavLink to="/account" onClick={() => setMenuOpen(false)}>View feature prices</NavLink>}
          </div>}
        </div>
        <div className="saas-owner-sidebar-foot">
          <ShieldCheck size={16} aria-hidden="true"/>
          <span>Company access verified by cubixgear</span>
        </div>
      </nav>
      {menuOpen && <button className="saas-owner-menu-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
      <main className="app-scroll-area saas-account-content" ref={scrollArea}>
        <div className="app-content">{children}</div>
      </main>
    </div>
  </div>;
}

export function WorkspaceAccessNotice({ unavailable = false, onRetry, paymentOverdue = false }) {
  const { logout } = useAuth();
  return <div className="saas-workspace-notice"><section>
    <Wallet size={30} aria-hidden="true"/>
    <h1>{unavailable ? 'Unable to verify company access' : paymentOverdue ? 'Company payment is overdue' : 'Workshop access is not active'}</h1>
    <p>{unavailable ? 'Refresh your company access to continue.' : paymentOverdue ? 'Contact your company owner to settle the outstanding usage payment.' : 'Your company owner must activate a module and allow your staff role before you can open the workshop.'}</p>
    <div><button type="button" onClick={onRetry}>Refresh access</button><button type="button" onClick={logout}>Sign out</button></div>
  </section></div>;
}

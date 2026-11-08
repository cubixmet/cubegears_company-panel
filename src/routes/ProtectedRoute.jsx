
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SaaSAccountLayout, WorkspaceAccessNotice } from '../components/layout/SaaSAccountLayout';
import { isAccountPath, isAccountOnly, setupRedirect } from '../utils/accountWorkspace';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { getPermissionForPath } from '../utils/permissions';
import { useFeatureAccess, moduleIsVisible } from '../context/FeatureAccessContext';

export const ProtectedRoute = () => {
  const { isAuthenticated, loading, user, sessionError, retrySession } = useAuth();
  const featureAccess = useFeatureAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--app-bg, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          fontSize: '14px'
        }}
      >
        Loading cubixgear…
      </div>
    );
  }

  if (sessionError) {
    return (
      <section className="api-session-error" role="alert" style={{
        minHeight: '100dvh', display: 'grid', placeContent: 'center',
        gap: '12px', padding: '24px', background: 'var(--app-bg)',
        color: 'var(--text-primary)', textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 750, margin: 0 }}>Unable to load your workspace</h2>
        <p style={{ fontSize: '14px', margin: 0, maxWidth: '520px', lineHeight: 1.5 }}>
          {sessionError}
        </p>
        <button type="button" onClick={retrySession} style={{
          minHeight: '44px', padding: '10px 16px', borderRadius: '10px',
          background: 'var(--primary)', color: '#fff', cursor: 'pointer'
        }}>Retry Connection</button>
      </section>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // New workshop owners cannot visit any other page until Django confirms
  // that all mandatory setup fields were saved. Render only the setup page:
  // no workspace shell, sidebar, header or bottom navigation.
  if (user?.onboardingRequired === true && user?.isCompanyOwner === true) {
    return location.pathname === '/onboarding'
      ? <Outlet />
      : <Navigate to="/onboarding" replace />;
  }

  // Even on completed accounts the wizard is a focused full-screen page.
  // Preserve owner-only access and avoid mounting the DashboardLayout.
  if (location.pathname === '/onboarding' && user?.isCompanyOwner === true) {
    return <Outlet />;
  }

  if (featureAccess.loading) {
    return <div role="status" aria-live="polite" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Checking feature access…</div>;
  }
  if (featureAccess.unavailable) return <WorkspaceAccessNotice unavailable onRetry={featureAccess.refresh} />;
  const isAccountRoute = isAccountPath(location.pathname);
  const setupTarget = setupRedirect(featureAccess, location.pathname);
  if (setupTarget) return <Navigate to={setupTarget} replace />;
  if (isAccountOnly(featureAccess) && !featureAccess.isCompanyOwner) {
    return <WorkspaceAccessNotice onRetry={featureAccess.refresh} paymentOverdue={featureAccess.billingStatus?.blocked} />;
  }
  if (isAccountRoute && !featureAccess.isCompanyOwner) {
    return <Navigate to="/access-denied" replace />;
  }
  const requiredPermission = getPermissionForPath(location.pathname);
  // Only the verified owner may finish initial setup without buying features;
  // Django independently enforces owner identity on every wizard API request.
  const isOwnerOnboarding = location.pathname === '/onboarding'
    && featureAccess.isCompanyOwner === true
    && featureAccess.permissions.includes('company.manage');
  // Supplier accounting requires both Inventory and Payments permission.
  const missingSupplierAccess = ['/suppliers/credits', '/suppliers/payments', '/stock/suppliers'].includes(location.pathname)
    && (!featureAccess.can('stock.view') || !featureAccess.can('payments.view'));
  // Nested Job Card sections require BOTH the Jobs label and their own
  // Stock/Invoices label; knowing a URL must not bypass either subscription.
  const nestedJobModule = /^\/jobs\/[^/]+\/(?:invoice|parts)(?:\/|$)/.test(location.pathname);
  const missingJobAccess = nestedJobModule && !featureAccess.can('jobs.view');
  const staffProfileMatch = location.pathname.match(/^\/staff-management\/staff\/([^/]+)$/);
  const isOwnStaffProfile =
    Boolean(staffProfileMatch) &&
    Boolean(user?.employeeProfileId) &&
    String(staffProfileMatch[1]) === String(user.employeeProfileId);
  if (
    location.pathname !== '/access-denied' &&
    requiredPermission &&
    (!isOwnerOnboarding && (missingJobAccess || missingSupplierAccess || !moduleIsVisible(featureAccess, requiredPermission) ||
      ((!isOwnStaffProfile || featureAccess.labelOnly) && !featureAccess.can(requiredPermission))))
  ) {
    return (
      <Navigate
        to={`/access-denied?permission=${encodeURIComponent(requiredPermission)}`}
        replace
      />
    );
  }

  if (featureAccess.billingStatus?.blocked && featureAccess.isCompanyOwner) return <SaaSAccountLayout><Outlet /></SaaSAccountLayout>;

  // Match the original unified workshop layout from commit
  // 17f0448d: one header/sidebar/mobile navigation for owners and staff.
  // The latest account-only, label and role guards above remain authoritative.
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};

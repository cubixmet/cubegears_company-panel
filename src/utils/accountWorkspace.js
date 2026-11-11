// Owner identity and shop details remain available before module activation.
export const PURCHASE_ACCOUNT_PATHS = new Set([
  '/account', '/account/credits/buy', '/account/credits/features', '/account/credits/logs',
  '/account/billing', '/account/plans', '/profile', '/account/company', '/account/storage',
]);

export const isAccountPath = (pathname = '') => pathname === '/account' || pathname.startsWith('/account/');

// Paid modules may be empty while the company still has FREE Dashboard/Staff
// access. Trust only the permissions and free-module list verified by Django.
export const hasFreeWorkspace = (access) => Boolean(
  Array.isArray(access?.freeModules) && Array.isArray(access?.permissions)
  && (
    (access.freeModules.includes('dashboard') && access.permissions.includes('dashboard.view'))
    || (access.freeModules.includes('staff') && access.permissions.includes('staff.view'))
    || (access.freeModules.includes('settings') && access.permissions.includes('settings.view'))
    || (access.freeModules.includes('roles') && access.permissions.includes('company.manage'))
    || access.permissions.includes('attendance.self')
  )
);

export const isAccountOnly = (access) => Boolean(
  access && !access.unavailable && (
    access.billingStatus?.blocked || (
      (access.enforced || access.paidAccessRequired || access.labelOnly)
      && Array.isArray(access.modules) && access.modules.length === 0
      && !hasFreeWorkspace(access)
    )
  )
);

export function setupRedirect(access, pathname) {
  if (!isAccountOnly(access)) return null;
  if (!access.isCompanyOwner) return pathname === '/access-denied' ? null : '/access-denied';
  const normalized = pathname.replace(/\/+$/, '') || '/';
  // Initial organization setup remains free for verified owners, including
  // workshops whose paid modules are not yet activated.
  if (normalized === '/onboarding') return null;
  if (normalized.startsWith('/account/storage/history/')) return null;
  if (normalized === '/account/storage/history') return null;
  if (access.billingStatus?.blocked && !isAccountPath(normalized)) return '/account';
  return PURCHASE_ACCOUNT_PATHS.has(normalized) ? null : '/account';
}
